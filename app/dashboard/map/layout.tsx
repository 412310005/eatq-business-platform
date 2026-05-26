/** map 為核心工作台：不做 static / router 長時間快取 */
export const dynamic = 'force-dynamic'

export default function MapSegmentLayout({ children }: { children: React.ReactNode }) {
  return children
}
