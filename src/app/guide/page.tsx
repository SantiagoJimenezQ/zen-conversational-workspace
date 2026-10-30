import Link from "next/link";
import { sources } from "@/lib/zen/sources";
export default function Guide() {
  return (
    <main className="guide-page">
      <Link href="/">← Back to Zen</Link>
      <h1>About this prototype</h1>
      <p>
        Zen explores how a conversation can move from a goal to a reviewed
        action. It is an independent, vendor-neutral product prototype.
      </p>
      <p>
        The conversation can use live AI through OpenRouter. All account
        records, phone inventory, prices and actions are sample data. No
        provider account is connected, and no real number is purchased or call
        placed.
      </p>
      <h2>Explore the demo</h2>
      <ul>
        {Object.values(sources).map((s) => (
          <li key={s.url}>
            <Link href={s.url}>{s.title}</Link>
          </li>
        ))}
      </ul>
      <h2>Your conversation</h2>
      <p>
        Chats are saved in this browser. In live mode, chat text is sent to
        OpenRouter and its model provider. Do not include personal information,
        private account records, or credentials. Public AI use is limited; the
        clearly labeled offline adapter remains available when the live preview
        budget is exhausted.
      </p>
      <p>
        Sample guides describe this prototype’s behavior. They are not official
        documentation for any company.
      </p>
      <p>
        <a href="/legal/Geist-OFL.txt">Geist font license</a> ·{" "}
        <a href="/legal/shadcn-LICENSE.txt">UI component license</a>
      </p>
    </main>
  );
}
