"use client";

import {
  Activity,
  BarChart3,
  ChevronRight,
  ChevronsUpDown,
  Clapperboard,
  Code2,
  ExternalLink,
  KeyRound,
  Megaphone,
  MessageCircle,
  MessageCircleMore,
  MessageSquare,
  MessagesSquare,
  Phone,
  Plug,
  Settings2,
  ShoppingCart,
  SquarePen,
  Users,
  Webhook,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

const navigation = [
  { label: "Connections", icon: Plug },
  { label: "Posts", icon: SquarePen, expand: true },
  { label: "Analytics", icon: BarChart3, expand: true },
  { label: "Inbox", icon: MessageSquare, expand: true },
  { label: "Ads", icon: Megaphone, expand: true },
  { label: "Commerce", icon: ShoppingCart, expand: true },
  { label: "WhatsApp", icon: MessagesSquare, expand: true },
  { label: "iMessage", icon: MessageCircle, expand: true },
  { label: "RCS", icon: MessageCircleMore, expand: true },
  { label: "Phone", icon: Phone, expand: true },
  { label: "Creators", icon: Clapperboard, expand: true },
  { label: "API Keys", icon: KeyRound },
  { label: "Users", icon: Users },
  { label: "Webhooks", icon: Webhook },
  { label: "Logs", icon: Activity },
  { label: "Settings", icon: Settings2, expand: true },
];
export function Navigation({
  onZen,
  onAccount,
  onNavigate,
}: {
  onZen: () => void;
  onAccount: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="nav-inner">
      <button
        className="account-switcher"
        onClick={onAccount}
        aria-label="Sample workspace details"
      >
        <Avatar>
          <AvatarFallback>S</AvatarFallback>
        </Avatar>
        <span>
          <strong>Demo</strong>
          <small>Default workspace</small>
        </span>
        <ChevronsUpDown />
      </button>
      <nav aria-label="Workspace navigation">
        <button
          className="nav-item is-selected"
          onClick={() => {
            onZen();
            onNavigate?.();
          }}
          aria-current="page"
        >
          <MessageCircle />
          <span>Zen</span>
        </button>
        {navigation.map(({ label, icon: Icon, expand }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                className="nav-item"
                onClick={() =>
                  toast.info(
                    `${label} is shown for dashboard context. This prototype focuses on Zen.`,
                  )
                }
              >
                <Icon />
                <span>{label}</span>
                {expand && <ChevronRight className="nav-chevron" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Dashboard reference · Zen is the working area
            </TooltipContent>
          </Tooltip>
        ))}
      </nav>
      <div className="nav-footer">
        <Separator />
        <a href="https://docs.zernio.com" target="_blank" rel="noreferrer">
          <Code2 />
          <span>Documentation</span>
          <ExternalLink />
        </a>
        <p>Unofficial concept · Sample navigation</p>
      </div>
    </div>
  );
}
