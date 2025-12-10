import { TourStep } from './TourProvider';

export const platformAdminTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome, Platform Admin! 👋',
    content: 'As a Platform Admin, you have full control over the entire Closer Claus platform. Let\'s take a quick tour of your powerful dashboard.',
    placement: 'bottom',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Navigation Sidebar',
    content: 'Access all platform sections from here. Each section gives you complete visibility into platform activity.',
    placement: 'right',
    hotspots: [
      {
        target: '[data-tour="nav-agencies"]',
        label: 'Agencies',
        description: 'View and manage all registered agencies on the platform.',
      },
      {
        target: '[data-tour="nav-sdrs"]',
        label: 'SDRs',
        description: 'Monitor all sales representatives and their performance.',
      },
    ],
  },
  {
    id: 'stats',
    target: '[data-tour="stats-grid"]',
    title: 'Platform Metrics',
    content: 'Monitor key metrics at a glance: total agencies, SDRs, pending disputes, platform revenue, and more. These update in real-time.',
    placement: 'bottom',
    action: 'click',
    actionLabel: 'Click the stats grid to see it in action',
  },
  {
    id: 'admin-controls',
    target: '[data-tour="admin-controls"]',
    title: 'Admin Controls',
    content: 'Access powerful admin tools to bypass email verification, unlock workspaces, and grant subscriptions. Use these powers responsibly!',
    placement: 'right',
  },
  {
    id: 'disputes',
    target: '[data-tour="disputes"]',
    title: 'Dispute Management',
    content: 'Review and resolve disputes between agencies and SDRs. You can approve, reject, or request more information.',
    placement: 'right',
  },
  {
    id: 'complete',
    target: '[data-tour="dashboard-header"]',
    title: 'You\'re All Set! 🎉',
    content: 'You now know the basics of the admin dashboard. Explore each section to manage your platform effectively. Need help? Check the documentation anytime.',
    placement: 'bottom',
  },
];

export const agencyOwnerTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome to Closer Claus! 👋',
    content: 'This is your agency dashboard where you can manage your sales team, track deals, and grow your business. Let\'s show you around!',
    placement: 'bottom',
  },
  {
    id: 'stats',
    target: '[data-tour="stats-grid"]',
    title: 'Your Key Metrics',
    content: 'See your agency\'s performance at a glance: team size, pipeline value, pending commissions, and more.',
    placement: 'bottom',
    action: 'click',
    actionLabel: 'Click to explore your metrics',
  },
  {
    id: 'navigation',
    target: '[data-tour="sidebar"]',
    title: 'Quick Navigation',
    content: 'Use the sidebar to navigate between sections. Here are some key areas you\'ll use frequently.',
    placement: 'right',
    hotspots: [
      {
        target: '[data-tour="nav-jobs"]',
        label: 'Post Jobs',
        description: 'Create job postings to attract talented SDRs to your team.',
      },
      {
        target: '[data-tour="nav-team"]',
        label: 'Your Team',
        description: 'View and manage your hired SDRs and their applications.',
      },
      {
        target: '[data-tour="nav-crm"]',
        label: 'CRM',
        description: 'Track leads and deals through your sales pipeline.',
      },
    ],
  },
  {
    id: 'dialer',
    target: '[data-tour="nav-dialer"]',
    title: 'Power Dialer',
    content: 'Make calls directly from the platform. Track call logs, record conversations, and boost your team\'s productivity.',
    placement: 'right',
  },
  {
    id: 'commissions',
    target: '[data-tour="nav-commissions"]',
    title: 'Commission Management',
    content: 'Track and pay commissions to your SDRs. View pending payouts, payment history, and platform fees.',
    placement: 'right',
  },
  {
    id: 'complete',
    target: '[data-tour="dashboard-header"]',
    title: 'Ready to Grow! 🚀',
    content: 'You\'re all set! Start by posting a job to hire your first SDR, or explore the CRM to manage your pipeline. Happy selling!',
    placement: 'bottom',
  },
];

export const sdrTourSteps: TourStep[] = [
  {
    id: 'welcome',
    target: '[data-tour="dashboard-header"]',
    title: 'Welcome, Sales Pro! 👋',
    content: 'This is your SDR dashboard where you can find jobs, manage deals, and track your earnings. Let\'s get you started!',
    placement: 'bottom',
  },
  {
    id: 'level',
    target: '[data-tour="sdr-level"]',
    title: 'Your SDR Level',
    content: 'As you close deals, you\'ll level up! Higher levels mean lower platform fees.',
    placement: 'right',
    action: 'click',
    actionLabel: 'Click to see your level progress',
    hotspots: [
      {
        target: '[data-tour="sdr-level"]',
        label: 'Level Progress',
        description: 'Level 1: 15% fee, Level 2: 10% fee, Level 3: 5% fee. Keep closing deals!',
      },
    ],
  },
  {
    id: 'stats',
    target: '[data-tour="stats-grid"]',
    title: 'Your Performance',
    content: 'Track your earnings, pending payouts, calls made, and deals closed. Watch these numbers grow!',
    placement: 'bottom',
  },
  {
    id: 'navigation',
    target: '[data-tour="sidebar"]',
    title: 'Navigate the Platform',
    content: 'Use these sections to find jobs, manage leads, and track your earnings.',
    placement: 'right',
    hotspots: [
      {
        target: '[data-tour="nav-jobs"]',
        label: 'Find Jobs',
        description: 'Browse and apply to available positions from agencies.',
      },
      {
        target: '[data-tour="nav-crm"]',
        label: 'Manage Leads',
        description: 'Work your assigned leads through the sales pipeline.',
      },
      {
        target: '[data-tour="nav-dialer"]',
        label: 'Make Calls',
        description: 'Use the power dialer to work through your call list.',
      },
    ],
  },
  {
    id: 'workspace',
    target: '[data-tour="workspace-switcher"]',
    title: 'Switch Workspaces',
    content: 'If you work for multiple agencies, use this to toggle between them. Each workspace is completely separate.',
    placement: 'right',
    action: 'click',
    actionLabel: 'Try clicking the workspace switcher',
  },
  {
    id: 'complete',
    target: '[data-tour="dashboard-header"]',
    title: 'Let\'s Crush It! 💪',
    content: 'You\'re ready to start selling! Browse available jobs, get hired, and start closing deals. The more you sell, the more you earn!',
    placement: 'bottom',
  },
];
