-- Create role enum
CREATE TYPE public.app_role AS ENUM ('platform_admin', 'agency_owner', 'sdr');

-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('omega', 'beta', 'alpha');

-- Create workspaces/agencies table
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  subscription_tier subscription_tier DEFAULT 'omega',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_sdrs INTEGER DEFAULT 1,
  rake_percentage DECIMAL(4,2) DEFAULT 2.00,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_roles table (secure pattern)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Create workspace_members table (links SDRs to workspaces)
CREATE TABLE public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_salary_exclusive BOOLEAN DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  removed_at TIMESTAMP WITH TIME ZONE,
  cooldown_until TIMESTAMP WITH TIME ZONE,
  UNIQUE (workspace_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is workspace owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE id = _workspace_id
      AND owner_id = _user_id
  )
$$;

-- Security definer function to check workspace membership
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id UUID, _workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE user_id = _user_id
      AND workspace_id = _workspace_id
      AND removed_at IS NULL
  )
$$;

-- Function to check if this is the first user (becomes platform admin)
CREATE OR REPLACE FUNCTION public.is_first_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1)
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "Platform admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

-- User roles RLS policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own role during signup"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Platform admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

-- Workspaces RLS policies
CREATE POLICY "Agency owners can view their own workspaces"
ON public.workspaces FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Agency owners can create workspaces"
ON public.workspaces FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'agency_owner'));

CREATE POLICY "Agency owners can update their own workspaces"
ON public.workspaces FOR UPDATE
TO authenticated
USING (owner_id = auth.uid());

CREATE POLICY "Workspace members can view their workspaces"
ON public.workspaces FOR SELECT
TO authenticated
USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Platform admins can view all workspaces"
ON public.workspaces FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

-- Workspace members RLS policies
CREATE POLICY "Agency owners can manage their workspace members"
ON public.workspace_members FOR ALL
TO authenticated
USING (public.is_workspace_owner(auth.uid(), workspace_id));

CREATE POLICY "SDRs can view their own memberships"
ON public.workspace_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Platform admins can view all memberships"
ON public.workspace_members FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'platform_admin'));

-- Function to handle new user signup (creates profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();