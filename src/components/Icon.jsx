import {
  Activity,
  Beef,
  Briefcase,
  ClipboardCheck,
  DollarSign,
  Grid2x2,
  Home,
  Package,
  ShieldPlus,
  TrendingUp,
  Users,
  UserRoundCog,
  Weight,
} from 'lucide-react';

const map = {
  grid: Grid2x2,
  home: Home,
  checklist: ClipboardCheck,
  userBadge: UserRoundCog,
  package: Package,
  chart: TrendingUp,
  scale: Weight,
  briefcase: Briefcase,
  users: Beef,
  flask: Users,
  shield: ShieldPlus,
  dollar: DollarSign,
  activity: Activity,
};

export default function Icon({ name, className = '' }) {
  const Cmp = map[name] || Grid2x2;
  return <Cmp size={16} className={className} aria-hidden="true" />;
}
