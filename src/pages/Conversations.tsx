import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { MessageSquare, Plus, Send, Users, ArrowLeft, Menu } from "lucide-react";
import { format } from "date-fns";
import { useSidebar } from "@/components/ui/sidebar";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_at: string;
  updated_at: string;
  workspace_id: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string | null; email: string };
}

interface Participant {
  id: string;
  user_id: string;
  is_read_only: boolean;
  left_at: string | null;
  profile?: { full_name: string | null; email: string };
}

interface WorkspaceMember {
  user_id: string;
  profile?: { full_name: string | null; email: string };
}

export default function Conversations() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [conversationName, setConversationName] = useState("");
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      fetchConversations();
      fetchWorkspaceMembers();
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages();
      fetchParticipants();
      checkReadOnlyStatus();

      // Subscribe to realtime messages
      const channel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          async (payload) => {
            const newMsg = payload.new as Message;
            // Fetch sender info
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', newMsg.sender_id)
              .single();
            
            setMessages(prev => [...prev, { ...newMsg, sender: profile || undefined }]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
    } else {
      setConversations(data || []);
    }
    setLoading(false);
  };

  const fetchWorkspaceMembers = async () => {
    if (!currentWorkspace) return;

    // Get workspace owner
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', currentWorkspace.id)
      .single();

    // Get workspace members
    const { data: members } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', currentWorkspace.id)
      .is('removed_at', null);

    const allUserIds = new Set<string>();
    if (workspace?.owner_id) allUserIds.add(workspace.owner_id);
    members?.forEach(m => allUserIds.add(m.user_id));

    // Fetch profiles for all members
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', Array.from(allUserIds));

    const membersWithProfiles = Array.from(allUserIds).map(userId => ({
      user_id: userId,
      profile: profiles?.find(p => p.id === userId)
    }));

    setWorkspaceMembers(membersWithProfiles.filter(m => m.user_id !== user?.id));
  };

  const fetchMessages = async () => {
    if (!selectedConversation) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', selectedConversation.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    // Fetch sender profiles
    const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', senderIds);

    const messagesWithSenders = data?.map(msg => ({
      ...msg,
      sender: profiles?.find(p => p.id === msg.sender_id)
    })) || [];

    setMessages(messagesWithSenders);
  };

  const fetchParticipants = async () => {
    if (!selectedConversation) return;

    const { data, error } = await supabase
      .from('conversation_participants')
      .select('*')
      .eq('conversation_id', selectedConversation.id);

    if (error) {
      console.error('Error fetching participants:', error);
      return;
    }

    // Fetch profiles
    const userIds = data?.map(p => p.user_id) || [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);

    const participantsWithProfiles = data?.map(p => ({
      ...p,
      profile: profiles?.find(pr => pr.id === p.user_id)
    })) || [];

    setParticipants(participantsWithProfiles);
  };

  const checkReadOnlyStatus = async () => {
    if (!selectedConversation || !user) return;

    const { data } = await supabase
      .from('conversation_participants')
      .select('is_read_only, left_at')
      .eq('conversation_id', selectedConversation.id)
      .eq('user_id', user.id)
      .single();

    setIsReadOnly(data?.is_read_only || data?.left_at !== null);
  };

  const createConversation = async () => {
    if (!currentWorkspace || !user || selectedMembers.length === 0) return;

    const isGroup = selectedMembers.length > 1;
    const name = isGroup ? conversationName : null;

    // Create conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        workspace_id: currentWorkspace.id,
        name,
        is_group: isGroup
      })
      .select()
      .single();

    if (convError) {
      toast.error('Failed to create conversation');
      console.error(convError);
      return;
    }

    // Add current user as participant
    const { error: selfError } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id: conversation.id,
        user_id: user.id
      });

    if (selfError) {
      console.error(selfError);
    }

    // Add selected members as participants
    const participantInserts = selectedMembers.map(memberId => ({
      conversation_id: conversation.id,
      user_id: memberId
    }));

    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert(participantInserts);

    if (partError) {
      toast.error('Failed to add participants');
      console.error(partError);
      return;
    }

    toast.success('Conversation created');
    setShowNewConversation(false);
    setSelectedMembers([]);
    setConversationName("");
    fetchConversations();
    setSelectedConversation(conversation);
  };

  const sendMessage = async () => {
    if (!selectedConversation || !user || !newMessage.trim() || isReadOnly) return;

    setSendingMessage(true);
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        content: newMessage.trim()
      });

    if (error) {
      toast.error('Failed to send message');
      console.error(error);
    } else {
      setNewMessage("");
    }
    setSendingMessage(false);
  };

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.is_group) return "Group Chat";
    return "Direct Message";
  };

  const getInitials = (name: string | null | undefined, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const { toggleSidebar } = useSidebar();

  return (
    <DashboardLayout>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center gap-2 p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={toggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-semibold">Conversations</h1>
      </div>

      <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)]">
        {/* Sidebar - Conversation List */}
        <div className="w-80 border-r border-border flex flex-col max-md:hidden md:flex">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-lg">Conversations</h2>
            <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {selectedMembers.length > 1 && (
                    <div className="space-y-2">
                      <Label>Group Name (optional)</Label>
                      <Input
                        value={conversationName}
                        onChange={(e) => setConversationName(e.target.value)}
                        placeholder="Enter group name..."
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Select Members</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {workspaceMembers.map((member) => (
                        <div key={member.user_id} className="flex items-center space-x-2">
                          <Checkbox
                            id={member.user_id}
                            checked={selectedMembers.includes(member.user_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMembers([...selectedMembers, member.user_id]);
                              } else {
                                setSelectedMembers(selectedMembers.filter(id => id !== member.user_id));
                              }
                            }}
                          />
                          <label htmlFor={member.user_id} className="text-sm cursor-pointer">
                            {member.profile?.full_name || member.profile?.email}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button 
                    onClick={createConversation} 
                    disabled={selectedMembers.length === 0}
                    className="w-full"
                  >
                    Create Conversation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                        {conv.is_group ? (
                          <Users className="h-5 w-5 text-primary" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{getConversationDisplayName(conv)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                    {selectedConversation.is_group ? (
                      <Users className="h-5 w-5 text-primary" />
                    ) : (
                      <MessageSquare className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{getConversationDisplayName(selectedConversation)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {participants.length} participants
                    </p>
                  </div>
                </div>
                {isReadOnly && (
                  <span className="text-xs bg-warning/20 text-warning px-2 py-1 rounded">
                    Read-only
                  </span>
                )}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(msg.sender?.full_name, msg.sender?.email || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[70%] ${isOwn ? 'items-end' : ''}`}>
                          <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-medium">
                              {msg.sender?.full_name || msg.sender?.email}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.created_at), 'h:mm a')}
                            </span>
                          </div>
                          <Card className={`p-3 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </Card>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t border-border">
                {isReadOnly ? (
                  <p className="text-center text-muted-foreground text-sm">
                    You can only view this conversation
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
