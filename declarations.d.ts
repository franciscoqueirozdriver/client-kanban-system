declare module "*.svg" {
  const c: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  export default c;
}
declare module "*.png" { const v: string; export default v; }
declare module "*.jpg" { const v: string; export default v; }
declare module "*.jpeg" { const v: string; export default v; }
declare module "*.gif" { const v: string; export default v; }
