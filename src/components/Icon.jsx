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

<<<<<<< HEAD
const ICON_MAP = {
=======
const map = {
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
  grid: Grid2x2,
  home: Home,
  checklist: ClipboardCheck,
  userBadge: UserRoundCog,
  package: Package,
  chart: TrendingUp,
  scale: Weight,
  briefcase: Briefcase,
<<<<<<< HEAD
  users: Users, // Changed from Beef to Users for more generic "users" icon
  flask: Users, // Assuming 'flask' might be a typo or intended to be a generic user icon
  shield: ShieldPlus,
  dollar: DollarSign,
  activity: Activity,
  // Adicione outros ícones conforme necessário
};

export default function Icon({ name, className = '', size = 16, label }) {
  const Cmp = ICON_MAP[name] || Grid2x2; // Fallback para Grid2x2 se o nome não for encontrado

  // Se um label for fornecido, o ícone é semântico. Caso contrário, é decorativo.
  const ariaProps = label ? { 'aria-label': label } : { 'aria-hidden': 'true' };

  return <Cmp size={size} className={className} {...ariaProps} />;
}
=======
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
>>>>>>> f7f6d2991c81e0a38b5e190db55c7ad82834360d
