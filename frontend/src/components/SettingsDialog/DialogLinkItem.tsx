import type { ReactNode } from 'react';

const CLS = 'flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors';

interface BaseProps {
  icon: ReactNode;
  children: ReactNode;
}

interface AnchorProps extends BaseProps {
  href: string;
}

interface ButtonProps extends BaseProps {
  onClick: () => void;
}

export function DialogLinkItem(props: AnchorProps | ButtonProps) {
  const { icon, children } = props;
  if ('href' in props) {
    return (
      <a href={props.href} target="_blank" rel="noopener noreferrer" className={CLS}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={`${CLS} text-left`}>
      {icon}
      {children}
    </button>
  );
}
