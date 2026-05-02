import { formatKstAmpmHm, type TextChatMessageGroupedDay } from "@/lib/text-chat-history-public";

function UserBubble({ body, time }: { body: string; time: string }) {
  return (
    <div className="y-tchat-msg-row y-tchat-msg-row--user">
      <div className="y-tchat-msg-user-pack">
        <div className="y-tchat-bubble y-tchat-bubble--user">
          <p className="y-tchat-bubble-text">{body}</p>
        </div>
        <span className="y-tchat-msg-time y-tchat-msg-time--user">{time}</span>
      </div>
    </div>
  );
}

function AssistantBubble({ body, time, han }: { body: string; time: string; han: string }) {
  return (
    <div className="y-tchat-msg-row y-tchat-msg-row--asst">
      <div className="y-tchat-msg-asst-avatar" aria-hidden>
        {han}
      </div>
      <div className="y-tchat-msg-asst-pack">
        <div className="y-tchat-bubble y-tchat-bubble--asst">
          <p className="y-tchat-bubble-text">{body}</p>
        </div>
        <span className="y-tchat-msg-time y-tchat-msg-time--asst">{time}</span>
      </div>
    </div>
  );
}

export function TextChatDetailThread({
  grouped,
  characterHan,
}: {
  grouped: TextChatMessageGroupedDay[];
  characterHan: string;
}) {
  return (
    <div className="y-tchat-thread">
      {grouped.map((g) => (
        <div key={g.dayKey} className="y-tchat-thread-day">
          <div className="y-tchat-day-sep" aria-hidden>
            <span className="y-tchat-day-sep-line" />
            <span className="y-tchat-day-sep-label">{g.dayTitle}</span>
            <span className="y-tchat-day-sep-line" />
          </div>
          {g.messages.map((m) =>
            m.role === "user" ? (
              <UserBubble key={m.id} body={m.body} time={formatKstAmpmHm(m.created_at)} />
            ) : (
              <AssistantBubble key={m.id} body={m.body} time={formatKstAmpmHm(m.created_at)} han={characterHan} />
            ),
          )}
        </div>
      ))}
    </div>
  );
}
