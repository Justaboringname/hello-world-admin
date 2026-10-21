import { Badge } from "@/components/ui";

// A meme the main app hides from signed-out visitors.
export function MembersOnlyBadge() {
  return <Badge tone="blue">🔓 Members only</Badge>;
}
