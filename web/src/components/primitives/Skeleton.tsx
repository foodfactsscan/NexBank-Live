interface Props {
  width?: number | string;
  height?: number | string;
  rounded?: number | string;
  style?: React.CSSProperties;
}
export function Skeleton({ width = '100%', height = 16, rounded = 6, style }: Props) {
  return <div className="skeleton" style={{ width, height, borderRadius: rounded, ...style }} />;
}
