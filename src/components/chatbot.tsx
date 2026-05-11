"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function getLocaleFromCookie(): "en" | "zh" {
  if (typeof document === "undefined") return "en"
  const match = document.cookie.match(/(?:^|;\s*)lang=([^;]*)/)
  return match?.[1] === "zh" ? "zh" : "en"
}

type QA = { q: RegExp; a: { en: string; zh: string } }

const qa: QA[] = [
  { q: /time|date|schedule|when|举办时间|时间|日期|什么时候|agenda|议程/, a: { en: "HOW 2027 will be held in April 2027 in Jinan, China. The exact dates will be announced soon. Check the Schedule page for the agenda.", zh: "HOW 2027 将于 2027 年 4 月在中国济南举办，具体日期即将公布。请查看议程页面了解详情。" } },
  { q: /venue|location|where|place|address|地点|哪里|在哪|地址|会场/, a: { en: "The conference will be held at Jinan Shandong Hotel (Shungeng International Convention Center), at 2-1 Ma'anshan Road, Shizhong District, Jinan, Shandong.", zh: "会议将在济南山东大厦（舜耕国际会议中心）举办，地址：山东省济南市市中区马鞍山路2-1号。" } },
  { q: /register|sign.?up|ticket|报名|注册|票|参加|参会/, a: { en: "You can register on the Register page. We offer Community Pass (free), VIP Pass (requires channel code), and Speaker Pass. Login is required to register.", zh: "您可以在报名页面注册。我们提供社区票（免费）、贵宾票（需渠道码）和讲者票。需要登录后才能报名。" } },
  { q: /cfp|submit|proposal|speak|talk|session|议题|投递|演讲|提交|投稿/, a: { en: "You can submit your talk proposal on the CFP page. You'll need to register and login first. Submissions include title, abstract, duration, and type (talk/workshop/panel).", zh: "您可以在投递演讲页面提交提案。需要先注册登录。提交内容包括标题、摘要、时长和类型（演讲/工作坊/圆桌）。" } },
  { q: /price|cost|free|paid|费用|价格|多少钱|收费|免费/, a: { en: "Community Pass is FREE for everyone. VIP Pass and Speaker Pass require a channel code from our partners.", zh: "社区票对所有人免费。贵宾票和讲者票需要使用合作伙伴提供的渠道码。" } },
  { q: /coc|conduct|行为|准则|规范|code/, a: { en: "HOW 2027 follows a Code of Conduct to ensure a safe, respectful environment for all participants. Harassment of any form is not tolerated. See the Code of Conduct page for details.", zh: "HOW 2027 遵循行为准则，确保为所有参会者提供安全、互相尊重的环境。不容忍任何形式的骚扰。详见行为准则页面。" } },
  { q: /contact|email|联系|邮件|问题|help|support/, a: { en: "For any questions, please contact us at conference@how2027.org", zh: "如有任何问题，请发送邮件至 conference@how2027.org。" } },
  { q: /speaker|讲者|讲师|嘉宾|谁.*来|who.*speak/, a: { en: "We have amazing speakers from IvorySQL, Supabase, Alibaba Cloud, AWS, GitLab, ByteDance, and more. Check the Schedule page for the full list.", zh: "我们有来自 IvorySQL、Supabase、阿里云、AWS、GitLab、字节跳动等公司的优秀讲者。查看议程页面获取完整列表。" } },
  { q: /stream|online|live|直播|线上|远程|看直播/, a: { en: "HOW 2027 is an in-person conference in Jinan. Online streaming details will be announced closer to the event.", zh: "HOW 2027 是在济南举办的线下会议。线上直播详情将在临近会议时公布。" } },
  { q: /cancel|refund|退票|取消|退款/, a: { en: "You can cancel your registration from your Profile page. For refund questions, please contact conference@how2027.org.", zh: "您可以在个人中心页面取消报名。退款相关问题请联系 conference@how2027.org。" } },
  { q: /hotel|酒店|住宿|accommodation/, a: { en: "The venue is Jinan Shandong Hotel. Nearby hotels include Sheraton Jinan and Hyatt Regency. We recommend booking early.", zh: "会场是济南山东大厦。附近酒店有济南喜来登和凯悦酒店。建议尽早预订。" } },
  { q: /transport|交通|地铁|机场|how.*get/, a: { en: "Jinan Yaoqiang International Airport is about 40 minutes from the venue by taxi. Jinan Railway Station is 15 minutes away.", zh: "济南遥墙国际机场打车到会场约 40 分钟，济南火车站约 15 分钟。" } },
  { q: /food|meal|lunch|dinner|吃饭|用餐|午餐|晚餐/, a: { en: "Lunch and coffee breaks are provided for all attendees during the conference days.", zh: "会议期间为所有参会者提供午餐和茶歇。" } },
  { q: /social|wechat|weixin|微信群|群聊|社区|community/, a: { en: "Join our community! Follow us on social media for updates. Check the Updates page for the latest news.", zh: "加入我们的社区！关注社交媒体获取最新动态。查看动态页面了解最新消息。" } },
]

function getAnswer(question: string, locale: "en" | "zh"): string {
  const q = question.toLowerCase()
  for (const item of qa) {
    if (item.q.test(q)) return item.a[locale]
  }
  return locale === "zh"
    ? "抱歉，我没有找到关于这个问题的信息。建议您查看相关页面或发送邮件至 conference@how2027.org 咨询。"
    : "Sorry, I couldn't find information about that. Please check the relevant page or email conference@how2027.org for assistance."
}

export function ChatbotWidget() {
  const [locale] = useState<"en" | "zh">(getLocaleFromCookie())
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSend() {
    const q = input.trim()
    if (!q) return
    const newMessages = [...messages, { role: "user" as const, text: q }]
    setMessages(newMessages)
    setInput("")
    setTimeout(() => {
      const answer = getAnswer(q, locale)
      setMessages([...newMessages, { role: "bot", text: answer }])
    }, 500)
  }

  const greeting = locale === "zh"
    ? "你好！我是 HOW 2027 的 AI 助手。有什么关于大会的问题可以问我！"
    : "Hi! I'm the HOW 2027 assistant. Ask me anything about the conference!"

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 w-[360px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[calc(100vh-10rem)] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{locale === "zh" ? "HOW 2027 助手" : "HOW 2027 Assistant"}</p>
                <p className="text-[10px] text-zinc-500">{locale === "zh" ? "AI 小助手" : "AI-powered"}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-zinc-200 max-w-[80%]">
                  {greeting}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-zinc-600" : "bg-gradient-to-br from-emerald-400 to-cyan-400"}`}>
                  {m.role === "user" ? (
                    <span className="text-xs font-bold text-white">U</span>
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm max-w-[80%] ${m.role === "user" ? "bg-emerald-600 text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-200 rounded-tl-sm"}`}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-zinc-800 flex items-center gap-2 shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSend()}
              placeholder={locale === "zh" ? "输入您的问题..." : "Ask a question..."}
              className="border-zinc-700 bg-zinc-800 text-sm h-10"
            />
            <Button size="icon" className="h-10 w-10 bg-emerald-600 hover:bg-emerald-500 shrink-0" onClick={handleSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-40"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  )
}
