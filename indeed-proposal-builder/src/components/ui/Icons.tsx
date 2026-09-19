import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} {...props}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 10.8 12 3l9 7.8" />
      <path d="M5.5 10.5V21h5.2v-6.2h2.6V21h5.2V10.5" />
    </Icon>
  );
}
export function IconFile(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6.5 3.5h7.8l3.2 3.4v13.6h-11z" />
      <path d="M14 3.5V7h3.5" />
      <path d="M9 11h6M9 14h6M9 17h4" />
    </Icon>
  );
}
export function IconFiles(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M8 4h8l3 3v13H8z" />
      <path d="M16 4v4h3" />
      <path d="M5 7v13h3" />
      <path d="M11 12h5M11 15h5" />
    </Icon>
  );
}
export function IconBox(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3 21 8l-9 5-9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </Icon>
  );
}
export function IconTemplate(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </Icon>
  );
}
export function IconDatabase(p: IconProps) {
  return (
    <Icon {...p}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </Icon>
  );
}
export function IconBell(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M18 8.5a6 6 0 0 0-12 0c0 6.7-2.5 7.4-2.5 8.9h17c0-1.5-2.5-2.2-2.5-8.9" />
      <path d="M14.2 20a2.4 2.4 0 0 1-4.4 0" />
    </Icon>
  );
}
export function IconHelp(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2A2.7 2.7 0 0 1 12.1 7c1.6 0 2.9 1 2.9 2.5 0 1.9-2 2.1-2.7 3.5" />
      <path d="M12 17.2h.01" />
    </Icon>
  );
}
export function IconSearch(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4.3-4.3" />
    </Icon>
  );
}
export function IconInfo(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Icon>
  );
}
export function IconCopy(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <rect x="4" y="4" width="12" height="12" rx="2" />
    </Icon>
  );
}
export function IconTrash(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 6h16" />
      <path d="M9 6V4h6v2" />
      <path d="m18 6-.8 14H6.8L6 6" />
      <path d="M10 10v6M14 10v6" />
    </Icon>
  );
}
export function IconDocx(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h4" />
      <path d="m8.4 12 1.1 5 1.5-4.2 1.5 4.2 1.1-5" />
    </Icon>
  );
}
export function IconPdf(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h4" />
      <path d="M8.5 16h7M8.5 12.5h7" />
    </Icon>
  );
}
