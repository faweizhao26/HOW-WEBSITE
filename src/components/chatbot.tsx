"use client"

import { useLocale } from "@/lib/i18n/provider"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { conference } from "@/lib/conference"


type QA = { q: RegExp; a: { en: string; zh: string } }

const contactEmail = "faweizhao26@gmail.com"

const qa: QA[] = [
  { q: /time|date|schedule|when|举办时间|时间|日期|什么时候|agenda|议程/, a: { en: "HOW 2027 will be held in Jinan, China, from April 16–18, 2027. The Schedule page has the latest published program.", zh: "HOW 2027 将于 2027 年 4 月 16 日至 18 日在中国济南举办。最新发布的议程请查看议程页面。" } },
  { q: /venue|location|where|place|address|地点|哪里|在哪|地址|会场/, a: { en: `${conference.venue.en}. The address and on-site directions will be published on the Venue page once confirmed.`, zh: `${conference.venue.zh}。具体地址和现场指引将在确认后更新到会场页面。` } },
  { q: /register|sign.?up|ticket|报名|注册|票|参加|参会/, a: { en: "You can register on the Register page after signing in. Available passes, eligibility and channel-code requirements are shown on that page.", zh: "登录后可在报名页面完成报名。当前可选票种、参与资格和渠道码要求以报名页面的说明为准。" } },
  { q: /speaker|讲者|讲师|嘉宾|谁.*来|who.*speak/, a: { en: "The Speakers page lists announced speakers. Check the Schedule page for their published sessions and times.", zh: "已公布的讲者请查看讲者页面，演讲内容和时间以议程页面的最新发布版本为准。" } },
  { q: /cfp|submit|proposal|speak|talk|session|议题|投递|演讲|提交|投稿/, a: { en: "You can submit your talk proposal on the CFP page. You'll need to register and login first. Submissions include title, abstract, duration, and type (talk/workshop/panel).", zh: "您可以在投递演讲页面提交提案。需要先注册登录。提交内容包括标题、摘要、时长和类型（演讲/工作坊/圆桌）。" } },
  { q: /price|cost|free|paid|费用|价格|多少钱|收费|免费/, a: { en: `Check the Register page for current ticket terms. For pricing or eligibility questions, contact ${contactEmail}.`, zh: `票务安排以报名页面当前说明为准。费用或参与资格问题请联系 ${contactEmail}。` } },
  { q: /coc|conduct|行为|准则|规范|code/, a: { en: "HOW 2027 follows a Code of Conduct to ensure a safe, respectful environment for all participants. Harassment of any form is not tolerated. See the Code of Conduct page for details.", zh: "HOW 2027 遵循行为准则，确保为所有参会者提供安全、互相尊重的环境。不容忍任何形式的骚扰。详见行为准则页面。" } },
  { q: /contact|email|联系|邮件|问题|help|support/, a: { en: `For any questions, please contact us at ${contactEmail}`, zh: `如有任何问题，请发送邮件至 ${contactEmail}。` } },
  { q: /stream|online|live|直播|线上|远程|看直播/, a: { en: "Whether live streaming will be offered, and how to watch, will be announced once confirmed. Check the Updates page for official information.", zh: "是否提供直播及观看方式待确认后公布，请关注动态页面的正式公告。" } },
  { q: /cancel|refund|退票|取消|退款/, a: { en: `You can cancel your registration from your Profile page. For refund questions, please contact ${contactEmail}.`, zh: `您可以在个人中心页面取消报名。退款相关问题请联系 ${contactEmail}。` } },
  { q: /hotel|酒店|住宿|accommodation/, a: { en: "Recommended hotel information will be published in the attendee guide once the venue and accommodation arrangements are confirmed.", zh: "会场及住宿安排确定后，推荐酒店信息会在参会指南中发布。" } },
  { q: /transport|交通|地铁|机场|how.*get/, a: { en: "Confirmed airport, railway and local transport routes will be published in the attendee guide. Travel times depend on your starting point and traffic; fixed journey times are not confirmed.", zh: "机场、高铁和本地交通路线将在确认后发布到参会指南。具体耗时取决于出发地点与路况，目前不提供已确认的固定车程。" } },
  { q: /food|meal|lunch|dinner|coffee|catering|吃饭|用餐|午餐|晚餐|茶歇|餐饮/, a: { en: "Meal and coffee-break arrangements are to be announced. Whether they are provided and which passes include them will be published in the attendee guide once confirmed.", zh: "餐饮和茶歇安排待公布。是否提供、哪些票种包含这些服务，以参会指南后续确认的信息为准。" } },
  { q: /social|wechat|weixin|微信群|群聊|社区|community/, a: { en: "Join our community! Follow us on social media for updates. Check the Updates page for the latest news.", zh: "加入我们的社区！关注社交媒体获取最新动态。查看动态页面了解最新消息。" } },
]

function getAnswer(question: string, locale: "en" | "zh"): string {
  const q = question.toLowerCase()
  for (const item of qa) {
    if (item.q.test(q)) return item.a[locale]
  }
  return locale === "zh"
    ? `抱歉，我没有找到关于这个问题的信息。建议您查看相关页面或发送邮件至 ${contactEmail} 咨询。`
    : `Sorry, I couldn't find information about that. Please check the relevant page or email ${contactEmail} for assistance.`
}

export function ChatbotWidget() {
  const locale = useLocale()
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
    const answer = getAnswer(q, locale)
    setMessages(current => [
      ...current,
      { role: "user", text: q },
      { role: "bot", text: answer },
    ])
    setInput("")
  }

  const greeting = locale === "zh"
    ? "你好！这里是 HOW 2027 大会问答。已确认信息以对应页面和正式公告为准。"
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
                <p className="text-xs text-zinc-400">{locale === "zh" ? "大会问答" : "Conference FAQ"}</p>
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
              onKeyDown={e => {
                if (e.key !== "Enter" || e.nativeEvent.isComposing) return
                e.preventDefault()
                handleSend()
              }}
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
