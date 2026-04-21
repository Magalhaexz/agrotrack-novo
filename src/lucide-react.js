import { createElement } from 'react';

function icon(path) {
  return function LucideIcon({ size = 16, className = '', ...props }) {
    return createElement(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        className,
        ...props,
      },
      path
    );
  };
}

const circle = createElement('circle', { cx: 12, cy: 12, r: 9 });
export const LayoutDashboard = icon([createElement('rect', {x:3,y:3,width:7,height:7,rx:1}),createElement('rect',{x:14,y:3,width:7,height:7,rx:1}),createElement('rect',{x:3,y:14,width:7,height:7,rx:1}),createElement('rect',{x:14,y:14,width:7,height:7,rx:1})]);
export const DollarSign = icon([createElement('path',{d:'M12 3v18'}),createElement('path',{d:'M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3'})]);
export const Package = icon([createElement('path',{d:'M3 7.5 12 3l9 4.5-9 4.5-9-4.5Z'}),createElement('path',{d:'M3 7.5V16.5L12 21l9-4.5V7.5'})]);
export const Syringe = icon([createElement('path',{d:'M4 20 20 4'}),createElement('path',{d:'M14 4l6 6'}),createElement('path',{d:'M11 7l6 6'})]);
export const Settings = icon([circle,createElement('path',{d:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'})]);
export const Beef = icon([circle,createElement('path',{d:'M7 14c2-1 8-1 10 0'})]);
export const PawPrint = Beef;
export const Bell = icon([createElement('path',{d:'M18 16H6l1-2V10a5 5 0 1 1 10 0v4z'}),createElement('path',{d:'M10 18a2 2 0 0 0 4 0'})]);
export const ChevronDown = icon([createElement('path',{d:'m6 9 6 6 6-6'})]);
export const Menu = icon([createElement('path',{d:'M3 6h18M3 12h18M3 18h18'})]);
export const X = icon([createElement('path',{d:'M6 6l12 12M18 6 6 18'})]);
export const ClipboardList = icon([createElement('rect',{x:5,y:4,width:14,height:16,rx:2}),createElement('path',{d:'M9 8h6M9 12h6M9 16h6'})]);
export const LogOut = icon([createElement('path',{d:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'}),createElement('path',{d:'m16 17 5-5-5-5M21 12H9'})]);
export const User = icon([createElement('circle',{cx:12,cy:8,r:3}),createElement('path',{d:'M6 20a6 6 0 0 1 12 0'})]);
export const Loader2 = icon([createElement('path',{d:'M12 3a9 9 0 1 0 9 9'})]);
export const FileSearch = icon([createElement('path',{d:'M14 14 21 21'}),createElement('circle',{cx:10,cy:10,r:7})]);
export const AlertTriangle = icon([createElement('path',{d:'M12 3 2 21h20L12 3z'}),createElement('path',{d:'M12 9v4M12 17h.01'})]);
export const CheckCircle2 = icon([createElement('circle',{cx:12,cy:12,r:9}),createElement('path',{d:'m8 12 3 3 5-5'})]);
export const Activity = icon([createElement('path',{d:'M3 12h4l2-5 4 10 2-5h6'})]);
export const Briefcase = icon([createElement('rect',{x:3,y:7,width:18,height:13,rx:2}),createElement('path',{d:'M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7'})]);
export const ClipboardCheck = ClipboardList;
export const Grid2x2 = LayoutDashboard;
export const Home = icon([createElement('path',{d:'M3 10.5 12 4l9 6.5'}),createElement('path',{d:'M5 9.5V20h14V9.5'})]);
export const ShieldPlus = icon([createElement('path',{d:'M12 3l7 3v5c0 4.5-2.7 8-7 10-4.3-2-7-5.5-7-10V6l7-3z'}),createElement('path',{d:'M12 9v6M9 12h6'})]);
export const TrendingUp = icon([createElement('path',{d:'M4 19h16'}),createElement('path',{d:'M6 15 10 11l3 2 5-6'})]);
export const Users = icon([createElement('circle',{cx:9,cy:8,r:3}),createElement('path',{d:'M4 19a5 5 0 0 1 10 0'}),createElement('circle',{cx:17,cy:9,r:2.5})]);
export const UserRoundCog = User;
export const Weight = icon([createElement('path',{d:'M12 3v18M5 7h14'})]);

export const ArrowUp = icon([createElement('path',{d:'m12 19V5'}),createElement('path',{d:'m5 12 7-7 7 7'})]);
export const ArrowDown = icon([createElement('path',{d:'m12 5v14'}),createElement('path',{d:'m5 12 7 7 7-7'})]);
export const BellRing = Bell;
export const CalendarClock = icon([createElement('rect',{x:3,y:5,width:18,height:16,rx:2}),createElement('path',{d:'M8 3v4M16 3v4M3 10h18'}),createElement('circle',{cx:16,cy:15,r:3})]);
export const Scale = Weight;
export const Tractor = icon([createElement('circle',{cx:8,cy:17,r:3}),createElement('circle',{cx:18,cy:17,r:2}),createElement('path',{d:'M3 17h3l2-6h7l2 6h4'}),createElement('path',{d:'M8 11V7h4'})]);

export const Plus = icon([createElement('path',{d:'M12 5v14M5 12h14'})]);
export const Truck = icon([createElement('rect',{x:2,y:7,width:12,height:8,rx:1}),createElement('path',{d:'M14 10h4l2 2v3h-6'}),createElement('circle',{cx:7,cy:17,r:2}),createElement('circle',{cx:17,cy:17,r:2})]);
export const ChevronRight = icon([createElement('path',{d:'m9 6 6 6-6 6'})]);
export const MoreHorizontal = icon([createElement('circle',{cx:6,cy:12,r:1.2}),createElement('circle',{cx:12,cy:12,r:1.2}),createElement('circle',{cx:18,cy:12,r:1.2})]);
export const Calendar = icon([createElement('rect',{x:3,y:5,width:18,height:16,rx:2}),createElement('path',{d:'M8 3v4M16 3v4M3 10h18'})]);

export const Pill = icon([createElement('rect',{x:4,y:9,width:16,height:6,rx:3}),createElement('path',{d:'M12 9v6'})]);
export const Leaf = icon([createElement('path',{d:'M5 19c7 0 14-6 14-14-8 0-14 7-14 14Z'}),createElement('path',{d:'M9 15c2-2 4-4 7-5'})]);
export const CheckSquare = icon([createElement('rect',{x:4,y:4,width:16,height:16,rx:2}),createElement('path',{d:'m8 12 3 3 5-5'})]);
export const Clock3 = icon([createElement('circle',{cx:12,cy:12,r:9}),createElement('path',{d:'M12 7v5h4'})]);
export const ArrowUpCircle = icon([createElement('circle',{cx:12,cy:12,r:9}),createElement('path',{d:'M12 16V8'}),createElement('path',{d:'m8 12 4-4 4 4'})]);
export const ArrowDownCircle = icon([createElement('circle',{cx:12,cy:12,r:9}),createElement('path',{d:'M12 8v8'}),createElement('path',{d:'m8 12 4 4 4-4'})]);
export const FileText = icon([createElement('path',{d:'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'}),createElement('path',{d:'M14 3v6h6'}),createElement('path',{d:'M8 13h8M8 17h8'})]);