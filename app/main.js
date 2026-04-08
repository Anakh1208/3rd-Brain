'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { supabase } from '@/lib/supabase'
import AuthPage from '@/components/AuthPage'
import RemindersTab from '@/components/RemindersTab'
import WeeklyRecap from '@/components/WeeklyRecap'
import DemoButton from '@/components/DemoButton'

const TOPIC_COLORS_DARK = {
  placements:    { bg: '#12102b', border: '#534AB7', text: '#AFA9EC', bubble: '#7F77DD' },
  exams:         { bg: '#1c1500', border: '#BA7517', text: '#FAC775', bubble: '#EF9F27' },
  fitness:       { bg: '#00170f', border: '#0F6E56', text: '#5DCAA5', bubble: '#1D9E75' },
  money:         { bg: '#180d00', border: '#993C1D', text: '#F0997B', bubble: '#D85A30' },
  health:        { bg: '#00170f', border: '#0F6E56', text: '#5DCAA5', bubble: '#1D9E75' },
  relationships: { bg: '#180012', border: '#993556', text: '#ED93B1', bubble: '#D4537E' },
  work:          { bg: '#12102b', border: '#534AB7', text: '#AFA9EC', bubble: '#7F77DD' },
  default:       { bg: '#141414', border: '#444',    text: '#999',    bubble: '#777'    },
}
const TOPIC_COLORS_LIGHT = {
  placements:    { bg: '#EEEDFE', border: '#534AB7', text: '#3C3489', bubble: '#7F77DD' },
  exams:         { bg: '#FEF5E0', border: '#BA7517', text: '#633806', bubble: '#EF9F27' },
  fitness:       { bg: '#E0F5EE', border: '#0F6E56', text: '#085041', bubble: '#1D9E75' },
  money:         { bg: '#FAECE7', border: '#993C1D', text: '#712B13', bubble: '#D85A30' },
  health:        { bg: '#E0F5EE', border: '#0F6E56', text: '#085041', bubble: '#1D9E75' },
  relationships: { bg: '#FBEAF0', border: '#993556', text: '#72243E', bubble: '#D4537E' },
  work:          { bg: '#EEEDFE', border: '#534AB7', text: '#3C3489', bubble: '#7F77DD' },
  default:       { bg: '#F0EFE9', border: '#888780', text: '#444441', bubble: '#888780' },
}
function getColor(topic, isDark) {
  const map = isDark ? TOPIC_COLORS_DARK : TOPIC_COLORS_LIGHT
  return map[topic?.toLowerCase()] || map.default
}
function getToday() { return new Date().toISOString().split('T')[0] }
function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d.toISOString().split('T')[0]
  })
}
function dayLabel(ds) { return ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(ds+'T12:00:00').getDay()] }

function Spinner({ T }) {
  return (
    <div style={{ minHeight:'100vh', background:'#07070f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:14 }}>🧠</div>
        <div style={{ fontSize:13, color:'#7777a0' }}>loading your brain...</div>
      </div>
    </div>
  )
}

export default function Home() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [isDark, setIsDark] = useState(true)
  const [rantText, setRantText] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [aiReply,  setAiReply]  = useState(null)
  const [worries,  setWorries]  = useState([])
  const [habits,   setHabits]   = useState([])
  const [events,   setEvents]   = useState([])
  const [selectedBubble, setSelectedBubble] = useState(null)
  const [toast,    setToast]    = useState(null)
  const [userEmail,setUserEmail]= useState('')
  const [nudgeEmail,setNudgeEmail]=useState('')
  const [nudgeSentMap,setNudgeSentMap]=useState({})
  const [activeTopic,  setActiveTopic]  = useState(null)
  const [timeLeft,     setTimeLeft]     = useState(0)
  const [isRunning,    setIsRunning]    = useState(false)
  const [timerMinutes, setTimerMinutes] = useState(25)
  const intervalRef = useRef(null)

  const T = isDark ? {
    bg:'#07070f',surface:'#0e0e1a',card:'#111120',border:'#1c1c2e',divider:'#181826',
    text:'#eeeeff',muted:'#7777a0',faint:'#222233',inputBg:'#09091a',
    accent:'#7F77DD',green:'#1D9E75',amber:'#EF9F27',
  } : {
    bg:'#f2f2f8',surface:'#ffffff',card:'#f9f9ff',border:'#dedeed',divider:'#ebebf5',
    text:'#111120',muted:'#555570',faint:'#e0e0ee',inputBg:'#f6f6fd',
    accent:'#534AB7',green:'#0F6E56',amber:'#854F0B',
  }

  const suggestions = ["I'm stressed about exams","I'm worried about placements","I'm procrastinating a lot","I don't have a proper routine"]

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(null),2800) }

  async function getAuthHeaders() {
    const { data:{session} } = await supabase.auth.getSession()
    if (!session) return { 'Content-Type':'application/json' }
    return { 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` }
  }

  const loadData = useCallback(async () => {
    try {
      const headers = await getAuthHeaders()
      const [w,h,e] = await Promise.all([
        fetch('/api/worries',{headers}).then(r=>r.json()),
        fetch('/api/habits', {headers}).then(r=>r.json()),
        fetch('/api/events', {headers}).then(r=>r.json()),
      ])
      if(Array.isArray(w)) setWorries(w)
      if(Array.isArray(h)) setHabits(h)
      if(Array.isArray(e)) setEvents(e)
    } catch(err){ console.error(err) }
  },[])

  useEffect(()=>{
    if(!user) return
    loadData()
    const saved = localStorage.getItem('3b_email') || user?.email || ''
    setUserEmail(saved); setNudgeEmail(saved)
  },[user,loadData])

  useEffect(()=>()=>{ if(intervalRef.current) clearInterval(intervalRef.current) },[])

  async function handleRant() {
    if(!rantText.trim()) return
    setLoading(true); setAiReply(null)
    try {
      const headers = await getAuthHeaders()
      const {data} = await fetch('/api/classify',{method:'POST',headers,body:JSON.stringify({text:rantText})}).then(r=>r.json())
      if(!data) throw new Error('No classification')

      const worry = await fetch('/api/worries',{method:'POST',headers,body:JSON.stringify({text:rantText,topic:data.topic})}).then(r=>r.json())

      if(data.habits?.length)
        await Promise.all(data.habits.map(h=>fetch('/api/habits',{method:'POST',headers,body:JSON.stringify({name:h.name,topic:data.topic,worry_id:worry.id})})))
      if(data.events?.length)
        await Promise.all(data.events.map(ev=>fetch('/api/events',{method:'POST',headers,body:JSON.stringify({name:ev.name,topic:data.topic,deadline:ev.deadline,worry_id:worry.id})})))

      try {
        const r = await fetch('/api/rag-pattern',{method:'POST',headers,body:JSON.stringify({text:rantText,user_id:user?.id||'demo'})}).then(r=>r.json())
        if(r.pattern_detected&&r.insight){data.pattern_insight=r.insight;data.repeat_count=r.repeat_count}
      } catch(_){}

      const emailToUse = userEmail || user?.email
      if(emailToUse) {
        try {
          const r = await fetch('/api/reminders',{method:'POST',headers,body:JSON.stringify({text:rantText,email:emailToUse})}).then(r=>r.json())
          if(r.has_reminder&&r.reminder) data._reminder=r.reminder
        } catch(_){}
      }

      setAiReply(data); setRantText(''); await loadData(); showToast('Plan generated ✓')
    } catch(err){ showToast('Error: '+err.message) }
    finally{ setLoading(false) }
  }

  async function toggleHabit(id) { const h=await getAuthHeaders(); await fetch('/api/habits',{method:'PATCH',headers:h,body:JSON.stringify({habit_id:id,completed_date:getToday()})}); await loadData() }
  async function toggleEvent(id,done) { const h=await getAuthHeaders(); await fetch('/api/events',{method:'PATCH',headers:h,body:JSON.stringify({id,done:!done})}); await loadData() }
  async function deleteHabit(id) { if(!confirm('Remove habit?')) return; const h=await getAuthHeaders(); await fetch('/api/habits',{method:'DELETE',headers:h,body:JSON.stringify({id})}); await loadData(); showToast('Removed') }
  async function deleteEvent(id) { if(!confirm('Remove event?')) return; const h=await getAuthHeaders(); await fetch('/api/events',{method:'DELETE',headers:h,body:JSON.stringify({id})}); await loadData(); showToast('Removed') }
  async function deleteWorry(id) { if(!confirm('Remove worry?')) return; const h=await getAuthHeaders(); await fetch('/api/worries',{method:'DELETE',headers:h,body:JSON.stringify({id})}); await loadData(); showToast('Removed') }
  async function sendBubbleNudge(topic,email) {
    if(!email?.trim()){showToast('Enter email first');return}
    const h=await getAuthHeaders()
    await fetch('/api/reminders',{method:'POST',headers:h,body:JSON.stringify({text:`remind me to work on my ${topic} concern`,email})})
    setNudgeSentMap(p=>({...p,[topic]:true})); showToast(`Nudge set for "${topic}" ✓`)
  }

  function startTimer() {
    if(isRunning) return
    const start = timeLeft>0 ? timeLeft : timerMinutes*60
    setTimeLeft(start); setIsRunning(true)
    intervalRef.current = setInterval(()=>{
      setTimeLeft(prev=>{
        if(prev<=1){clearInterval(intervalRef.current);setIsRunning(false);showToast('Focus session complete! 🎉');return 0}
        return prev-1
      })
    },1000)
  }
  function pauseTimer(){clearInterval(intervalRef.current);setIsRunning(false)}
  function resetTimer(){clearInterval(intervalRef.current);setIsRunning(false);setTimeLeft(0)}
  const fmt = s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`

  const topicMap={}
  worries.forEach(w=>{const t=w.topic||'other';if(!topicMap[t])topicMap[t]={count:0,habits:[],events:[],worries:[]};topicMap[t].count++;topicMap[t].worries.push(w)})
  habits.forEach(h=>{const t=h.topic||'other';if(topicMap[t])topicMap[t].habits.push(h)})
  events.forEach(e=>{const t=e.topic||'other';if(topicMap[t])topicMap[t].events.push(e)})
  const topics=Object.entries(topicMap).sort((a,b)=>b[1].count-a[1].count)
  const totalWorries=worries.length
  const totalActionsDone=events.filter(e=>e.done).length+habits.reduce((acc,h)=>acc+(h.habit_completions?.length||0),0)
  const gapScore=totalWorries>0?Math.max(0,Math.round(100-(totalActionsDone/Math.max(totalWorries,1))*50)):0

  function getWeekDone(habit){const s=new Set((habit.habit_completions||[]).map(c=>c.completed_date));return getLast7Days().map(d=>({date:d,done:s.has(d)}))}
  function getStreak(habit){const s=new Set((habit.habit_completions||[]).map(c=>c.completed_date));let st=0;for(let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-i);if(s.has(d.toISOString().split('T')[0]))st++;else if(i>0)break}return st}

  const card={background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:'20px'}
  const secLabel={fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:T.muted,marginBottom:14}
  const emptyBox={fontSize:12,color:T.muted,textAlign:'center',padding:'24px 0',border:`1px dashed ${T.border}`,borderRadius:10,marginBottom:12}
  const delBtn={width:20,height:20,borderRadius:'50%',background:'transparent',border:`0.5px solid ${T.border}`,cursor:'pointer',color:T.muted,fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}

  if(authLoading) return <Spinner/>
  if(!user) return <AuthPage/>

  const userName=user?.user_metadata?.full_name?.split(' ')[0]||user?.email?.split('@')[0]||'there'

  return (
    <div style={{minHeight:'100vh',background:T.bg,color:T.text}}>
      <style>{`
        @keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:${T.faint};border-radius:2px}
        textarea,input,select{font-family:inherit}
        textarea:focus,input:focus,select:focus{outline:none}
        @media(max-width:900px){.g2{grid-template-columns:1fr !important}.g3{grid-template-columns:1fr !important}}
        @media(max-width:600px){.mp{padding:12px !important}.hs{display:none !important}}
      `}</style>

      {toast&&<div style={{position:'fixed',top:18,right:18,zIndex:999,background:'#1D9E75',color:'#fff',padding:'9px 16px',borderRadius:10,fontSize:12,fontWeight:600,boxShadow:'0 4px 20px rgba(29,158,117,.35)',animation:'fadeDown 0.2s ease'}}>{toast}</div>}

      {/* HEADER */}
      <header style={{position:'sticky',top:0,zIndex:60,background:T.surface,borderBottom:`1px solid ${T.border}`,padding:'0 24px',height:52,display:'flex',alignItems:'center',gap:14}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flex:1}}>
          <span style={{fontSize:15,fontWeight:800,color:T.text,letterSpacing:'-0.5px'}}>🧠 3rd Brain</span>
          <span style={{fontSize:10,fontWeight:700,color:isDark?'#AFA9EC':'#3C3489',background:isDark?'#1a1535':'#EEEDFE',border:`1px solid ${isDark?'#534AB740':'#534AB740'}`,padding:'3px 9px',borderRadius:20}}>gap · {gapScore}</span>
        </div>
        <div className="hs" style={{display:'flex',gap:12,fontSize:11,color:T.muted}}>
          <span>hi, {userName}</span>
          <span style={{color:T.faint}}>·</span>
          <span>{worries.length}w · {habits.length}h · {events.length}e</span>
        </div>
        <DemoButton onDemoLogin={id=>console.log('demo:',id)}/>
        <button onClick={()=>setIsDark(d=>!d)} style={{width:34,height:34,borderRadius:'50%',background:T.card,border:`1px solid ${T.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,color:isDark?'#FAC775':'#534AB7'}}>{isDark?'☀':'☾'}</button>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:isDark?'#1a1535':'#EEEDFE',border:`1px solid ${isDark?'#534AB760':'#534AB760'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:isDark?'#AFA9EC':'#3C3489'}}>{userName[0]?.toUpperCase()}</div>
          <button onClick={signOut} style={{background:'none',border:`1px solid ${T.border}`,borderRadius:8,padding:'5px 10px',color:T.muted,fontSize:11,cursor:'pointer'}}>sign out</button>
        </div>
      </header>

      <main className="mp" style={{padding:'20px 24px',maxWidth:1320,margin:'0 auto'}}>

        {/* ROW 1 — Rant + Map */}
        <div className="g2" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>

          {/* RANT */}
          <div style={card}>
            <div style={secLabel}>unload your mind</div>
            <textarea value={rantText} onChange={e=>setRantText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&e.ctrlKey&&handleRant()} placeholder="i have exams next week and haven't studied. also terrified about placements..." rows={5}
              style={{width:'100%',background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:12,padding:'12px 14px',fontSize:13,color:T.text,resize:'none',lineHeight:1.75,marginBottom:10,transition:'border-color 0.2s'}}
              onFocus={e=>e.target.style.borderColor=T.accent+'80'} onBlur={e=>e.target.style.borderColor=T.border}/>
            {!rantText&&<div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
              {suggestions.map((s,i)=><button key={i} onClick={()=>setRantText(s)} style={{padding:'5px 12px',fontSize:11,borderRadius:20,background:'transparent',border:`1px solid ${T.border}`,color:T.muted,cursor:'pointer'}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.color=T.accent}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.color=T.muted}}>{s}</button>)}
            </div>}
            <button onClick={handleRant} disabled={loading||!rantText.trim()} style={{width:'100%',padding:'12px',background:loading||!rantText.trim()?T.faint:isDark?'#7F77DD':'#534AB7',border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:loading||!rantText.trim()?'not-allowed':'pointer',opacity:loading||!rantText.trim()?0.4:1}}>
              {loading?'analyzing...':'unload it →'}
            </button>

            {aiReply&&<div style={{marginTop:14,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,padding:14,animation:'fadeUp 0.25s ease'}}>
              <div style={{fontSize:10,color:T.accent,fontWeight:700,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.1em'}}>{aiReply.topic} · classified</div>
              <p style={{fontSize:13,color:T.muted,lineHeight:1.7,marginBottom:10}}>{aiReply.summary}</p>
              {aiReply.habits?.length>0&&<div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:T.green,marginBottom:6,fontWeight:700,textTransform:'uppercase'}}>habits</div>
                {aiReply.habits.map((h,i)=><div key={i} style={{fontSize:12,color:T.text,padding:'3px 0',display:'flex',gap:8,alignItems:'center'}}><span style={{width:4,height:4,borderRadius:'50%',background:T.green,flexShrink:0}}/>{h.name}</div>)}
              </div>}
              {aiReply.events?.length>0&&<div style={{marginBottom:10}}>
                <div style={{fontSize:10,color:T.amber,marginBottom:6,fontWeight:700,textTransform:'uppercase'}}>events</div>
                {aiReply.events.map((e,i)=><div key={i} style={{fontSize:12,color:T.text,padding:'3px 0',display:'flex',gap:8,alignItems:'center'}}><span style={{width:4,height:4,borderRadius:'50%',background:T.amber,flexShrink:0}}/>{e.name}{e.deadline&&<span style={{color:T.muted,fontSize:11}}>· {e.deadline}</span>}</div>)}
              </div>}
              {aiReply.gap&&<div style={{background:isDark?'#1a1535':'#EEEDFE',borderRadius:8,padding:'8px 12px',fontSize:12,color:isDark?'#AFA9EC':'#3C3489',lineHeight:1.6}}>{aiReply.gap}</div>}
              {aiReply.pattern_insight&&<div style={{background:isDark?'#1a0e00':'#FAECE7',borderRadius:8,padding:'8px 12px',fontSize:12,color:isDark?'#F0997B':'#712B13',marginTop:6,lineHeight:1.5}}>🔁 repeated ({aiReply.repeat_count}×) — {aiReply.pattern_insight}</div>}
              {aiReply._reminder&&<div style={{background:isDark?'#001710':'#E0F5EE',border:`1px solid ${isDark?'#0F6E5640':'#0F6E5640'}`,borderRadius:8,padding:'8px 12px',fontSize:12,color:isDark?'#5DCAA5':'#085041',marginTop:6}}>📅 reminder set for <strong>{aiReply._reminder.title}</strong></div>}
            </div>}

            {worries.length>0&&<div style={{marginTop:14}}>
              <div style={{...secLabel,marginBottom:8}}>recent worries</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {worries.slice(0,8).map(w=>{const c=getColor(w.topic,isDark);return(
                  <span key={w.id} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',background:c.bg,border:`1px solid ${c.border}`,borderRadius:16,fontSize:11,color:c.text,fontWeight:500}}>
                    <span style={{width:4,height:4,borderRadius:'50%',background:c.bubble}}/>
                    {w.topic||'worry'}
                    <button onClick={e=>{e.stopPropagation();deleteWorry(w.id)}} style={{background:'none',border:'none',color:T.muted,cursor:'pointer',fontSize:13,paddingLeft:4}}>×</button>
                  </span>
                )})}
              </div>
            </div>}
          </div>

          {/* CONCERN MAP */}
          <div style={card}>
            <div style={secLabel}>concern map</div>
            {topics.length===0?(
              <div style={{textAlign:'center',padding:'80px 20px',color:T.muted,fontSize:13}}>
                <div style={{fontSize:36,marginBottom:10}}>🧠</div>rant first to see your concern bubbles
              </div>
            ):(
              <>
                <div style={{position:'relative',height:230,marginBottom:14,background:isDark?'radial-gradient(circle at 50% 50%, #0d0d1e 0%, #07070f 100%)':'radial-gradient(circle at 50% 50%, #f5f5ff 0%, #eeeef8 100%)',borderRadius:12,overflow:'hidden',border:`1px solid ${T.border}`}}>
                  {topics.slice(0,7).map(([topic,data],i)=>{
                    const c=getColor(topic,isDark),max=topics[0][1].count,size=52+(data.count/max)*72
                    const POS=[{left:'10%',top:'14%'},{left:'54%',top:'15%'},{left:'28%',top:'52%'},{left:'63%',top:'55%'},{left:'40%',top:'30%'},{left:'7%',top:'65%'},{left:'74%',top:'35%'}]
                    const pos=POS[i%POS.length],sel=selectedBubble===topic
                    return <div key={topic} onClick={()=>setSelectedBubble(sel?null:topic)}
                      style={{position:'absolute',left:pos.left,top:pos.top,width:size,height:size,borderRadius:'50%',background:c.bg,border:`${sel?2:1}px solid ${sel?c.bubble:c.border}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',transform:sel?'scale(1.14)':'scale(1)',transition:'all 0.28s cubic-bezier(0.34,1.56,0.64,1)',zIndex:sel?3:1,boxShadow:sel?`0 6px 22px ${c.bubble}50`:'none'}}
                      onMouseEnter={e=>{if(!sel)e.currentTarget.style.transform='scale(1.07)'}}
                      onMouseLeave={e=>{if(!sel)e.currentTarget.style.transform='scale(1)'}}>
                      <span style={{fontSize:Math.max(9,size*0.15),fontWeight:600,color:c.text,textAlign:'center',padding:'0 4px',lineHeight:1.2}}>{topic}</span>
                      <span style={{fontSize:9,color:c.bubble,marginTop:2,fontWeight:700}}>{data.count}×</span>
                    </div>
                  })}
                </div>

                {selectedBubble&&topicMap[selectedBubble]&&(
                  <div style={{background:T.card,border:`1px solid ${getColor(selectedBubble,isDark).border}`,borderRadius:12,padding:14,marginBottom:12,animation:'fadeUp 0.2s ease'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <span style={{fontSize:14,fontWeight:700,color:T.text}}>{selectedBubble}</span>
                      <span style={{fontSize:9,padding:'3px 9px',borderRadius:10,fontWeight:700,background:topicMap[selectedBubble].count>=4?(isDark?'#1a0505':'#FCEBEB'):topicMap[selectedBubble].count>=2?(isDark?'#1c1400':'#FEF5E0'):(isDark?'#001710':'#E0F5EE'),color:topicMap[selectedBubble].count>=4?(isDark?'#F09595':'#A32D2D'):topicMap[selectedBubble].count>=2?(isDark?'#FAC775':'#633806'):(isDark?'#5DCAA5':'#085041')}}>
                        {topicMap[selectedBubble].count>=4?'high gap':topicMap[selectedBubble].count>=2?'med gap':'low gap'}
                      </span>
                    </div>
                    <div style={{fontSize:11,color:T.muted,marginBottom:10}}>{topicMap[selectedBubble].count} worries · {topicMap[selectedBubble].habits.length} habits · {topicMap[selectedBubble].events.length} events</div>
                    {topicMap[selectedBubble].habits.slice(0,3).map(h=>(
                      <div key={h.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${T.divider}`,fontSize:12,color:T.muted}}>
                        <span style={{width:3,height:3,borderRadius:'50%',background:T.green,flexShrink:0}}/><span style={{flex:1}}>{h.name}</span>
                        <span style={{fontSize:9,color:T.muted}}>habit</span><button onClick={()=>deleteHabit(h.id)} style={delBtn}>×</button>
                      </div>
                    ))}
                    {topicMap[selectedBubble].events.slice(0,3).map(e=>(
                      <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${T.divider}`,fontSize:12,color:e.done?T.muted:T.text,textDecoration:e.done?'line-through':'none'}}>
                        <span style={{width:3,height:3,borderRadius:'50%',background:T.accent,flexShrink:0}}/><span style={{flex:1}}>{e.name}</span>
                        {e.deadline&&<span style={{fontSize:9,color:T.muted}}>· {e.deadline}</span>}
                        <span style={{fontSize:9,color:e.done?T.green:T.muted}}>{e.done?'done':'event'}</span>
                        <button onClick={()=>deleteEvent(e.id)} style={delBtn}>×</button>
                      </div>
                    ))}
                    <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.divider}`}}>
                      <div style={{fontSize:10,color:T.muted,marginBottom:8,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em'}}>schedule a nudge</div>
                      {nudgeSentMap[selectedBubble]?(
                        <div style={{fontSize:11,color:T.green,fontWeight:600,padding:'6px 0'}}>nudge scheduled ✓</div>
                      ):(
                        <div style={{display:'flex',gap:6}}>
                          <input type="email" placeholder="your email" value={nudgeEmail} onChange={e=>setNudgeEmail(e.target.value)}
                            style={{flex:1,background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:'7px 10px',fontSize:12,color:T.text}}
                            onFocus={e=>e.target.style.borderColor=T.accent+'80'} onBlur={e=>e.target.style.borderColor=T.border}/>
                          <button onClick={()=>sendBubbleNudge(selectedBubble,nudgeEmail)} style={{padding:'7px 14px',background:nudgeEmail?T.green:T.faint,border:'none',borderRadius:8,color:'#fff',fontSize:11,fontWeight:700,cursor:nudgeEmail?'pointer':'not-allowed',whiteSpace:'nowrap'}}>nudge me</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div style={{maxHeight:220,overflowY:'auto'}}>
                  {topics.map(([topic,data])=>{
                    const c=getColor(topic,isDark),done=data.events.filter(e=>e.done).length,isSel=selectedBubble===topic
                    return <div key={topic} onClick={()=>setSelectedBubble(isSel?null:topic)}
                      style={{background:c.bg,border:`1px solid ${isSel?c.bubble:c.border}`,borderRadius:10,padding:'10px 12px',marginBottom:6,cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',transition:'all 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=c.bubble}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=isSel?c.bubble:c.border}>
                      <div>
                        <span style={{fontSize:13,fontWeight:600,color:c.text}}>{topic}</span>
                        <div style={{fontSize:10,color:T.muted,marginTop:2}}>{data.count} worries · {done}/{data.habits.length+data.events.length} done</div>
                      </div>
                      <span style={{fontSize:22,fontWeight:800,color:c.bubble,opacity:0.8}}>{data.count}×</span>
                    </div>
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ROW 2 — Plan + Gap + Timer */}
        <div id="plan-section" className="g3" style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:16,marginBottom:16}}>

          {/* MY PLAN */}
          <div style={card}>
            <div style={secLabel}>my plan</div>
            <div style={{fontSize:11,color:T.green,fontWeight:700,marginBottom:10}}>✓ habits ({habits.length})</div>
            {habits.length===0?<div style={emptyBox}>no habits yet — rant to generate some</div>:(
              <div style={{marginBottom:18}}>
                {habits.map(habit=>{
                  const streak=getStreak(habit),week=getWeekDone(habit),c=getColor(habit.topic,isDark),tod=week.find(d=>d.date===getToday())?.done
                  return <div key={habit.id} style={{background:T.card,border:`1px solid ${tod?T.green:T.border}`,borderRadius:12,padding:'12px 14px',marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{habit.name}</div>
                        <span style={{fontSize:9,color:c.text,background:c.bg,padding:'2px 7px',borderRadius:8,fontWeight:600,border:`1px solid ${c.border}`}}>{habit.topic}</span>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {streak>0&&<span style={{fontSize:10,color:isDark?'#FAC775':'#633806',background:isDark?'#1c1500':'#FEF5E0',padding:'3px 8px',borderRadius:10,fontWeight:700}}>🔥 {streak}</span>}
                        <button onClick={()=>toggleHabit(habit.id)} style={{width:28,height:28,borderRadius:'50%',background:tod?T.green:'transparent',border:`2px solid ${tod?T.green:T.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {tod&&<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="2,5 4,7 8,3" stroke="#fff" strokeWidth="2" fill="none"/></svg>}
                        </button>
                        <button onClick={()=>deleteHabit(habit.id)} style={delBtn}>×</button>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      {week.map(({date,done})=>(
                        <div key={date} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                          <div style={{fontSize:8,color:T.muted}}>{dayLabel(date)}</div>
                          <div style={{width:'100%',height:22,borderRadius:5,background:done?T.green:date===getToday()?(isDark?'#1a1535':'#EEEDFE'):T.faint,border:`1px solid ${date===getToday()?T.accent+'60':'transparent'}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {done&&<span style={{fontSize:9,color:'#fff',fontWeight:700}}>✓</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                })}
              </div>
            )}

            <div style={{fontSize:11,color:T.accent,fontWeight:700,marginBottom:10}}>📅 events ({events.length})</div>
            {events.length===0?<div style={emptyBox}>no events yet</div>:events.map(ev=>(
              <div key={ev.id} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'10px 12px',marginBottom:6,display:'flex',gap:10,alignItems:'center',opacity:ev.done?0.55:1}}>
                <button onClick={()=>toggleEvent(ev.id,ev.done)} style={{width:24,height:24,borderRadius:'50%',flexShrink:0,background:ev.done?T.accent:'transparent',border:`2px solid ${ev.done?T.accent:T.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {ev.done&&<svg width="9" height="9" viewBox="0 0 9 9"><polyline points="2,4.5 3.5,6 7,2.5" stroke="#fff" strokeWidth="2" fill="none"/></svg>}
                </button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:ev.done?T.muted:T.text,textDecoration:ev.done?'line-through':'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.name}</div>
                  <div style={{display:'flex',gap:6,alignItems:'center',marginTop:3}}>
                    {ev.deadline&&<span style={{fontSize:9,color:T.muted}}>📆 {ev.deadline}</span>}
                    <span style={{fontSize:9,padding:'2px 6px',borderRadius:6,background:getColor(ev.topic,isDark).bg,color:getColor(ev.topic,isDark).text,border:`1px solid ${getColor(ev.topic,isDark).border}`}}>{ev.topic}</span>
                  </div>
                </div>
                <button onClick={()=>deleteEvent(ev.id)} style={delBtn}>×</button>
              </div>
            ))}
          </div>

          {/* GAP SCORE */}
          <div style={card}>
            <div style={secLabel}>gap score</div>
            <WeeklyRecap userId={user?.id||'demo'}/>
            <div style={{textAlign:'center',padding:'14px 0 10px'}}>
              <div style={{fontSize:68,fontWeight:900,lineHeight:1,marginBottom:8,background:gapScore>70?'linear-gradient(135deg,#F09595,#D4537E)':gapScore>40?'linear-gradient(135deg,#FAC775,#EF9F27)':'linear-gradient(135deg,#5DCAA5,#1D9E75)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text'}}>{gapScore}</div>
              <div style={{fontSize:11,color:T.muted}}>{gapScore>70?'— high, take action':gapScore>40?'— medium, keep going':"— low, you're crushing it"}</div>
            </div>
            <div style={{borderTop:`1px solid ${T.divider}`,paddingTop:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,textAlign:'center',marginBottom:14}}>
              {[{val:totalWorries,label:'worries',color:T.accent},{val:totalActionsDone,label:'actions',color:T.green},{val:Math.round(totalWorries>0?(totalActionsDone/totalWorries)*100:0)+'%',label:'progress',color:T.amber}].map(({val,label,color})=>(
                <div key={label}><div style={{fontSize:22,fontWeight:700,color}}>{val}</div><div style={{fontSize:9,color:T.muted,marginTop:2}}>{label}</div></div>
              ))}
            </div>
            {topics.length>0&&(
              <div style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:'12px 14px'}}>
                <div style={{fontSize:10,color:T.accent,fontWeight:700,marginBottom:8}}>by topic</div>
                {topics.slice(0,5).map(([topic,data])=>{
                  const done=data.events.filter(e=>e.done).length,total=data.habits.length+data.events.length,pct=total>0?Math.round((done/total)*100):0,c=getColor(topic,isDark)
                  return <div key={topic} style={{marginBottom:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:10,marginBottom:3}}>
                      <span style={{color:c.text,fontWeight:600}}>{topic}</span>
                      <span style={{color:T.muted}}>{data.count}× · {pct}%</span>
                    </div>
                    <div style={{height:4,background:T.faint,borderRadius:2,overflow:'hidden'}}>
                      <div style={{width:`${pct}%`,height:'100%',background:c.bubble,borderRadius:2,transition:'width 0.4s'}}/>
                    </div>
                  </div>
                })}
              </div>
            )}
          </div>

          {/* FOCUS TIMER */}
          <div style={card}>
            <div style={secLabel}>focus timer</div>
            {topics.length===0?<div style={{textAlign:'center',padding:'50px 10px',color:T.muted,fontSize:12}}>rant to unlock focus bubbles</div>:(
              <>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:14}}>
                  {topics.map(([topic,data])=>{
                    const c=getColor(topic,isDark),isActive=activeTopic===topic
                    return <button key={topic} onClick={()=>{setActiveTopic(isActive?null:topic);resetTimer()}}
                      style={{padding:'5px 11px',borderRadius:20,background:c.bg,border:`${isActive?2:1}px solid ${isActive?c.bubble:c.border}`,color:c.text,fontSize:11,fontWeight:isActive?700:500,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:c.bubble}}/>{topic}<span style={{fontSize:9,color:c.bubble}}>({data.count})</span>
                    </button>
                  })}
                </div>
                {activeTopic?(
                  <div style={{textAlign:'center'}}>
                    <div style={{fontSize:42,fontWeight:900,fontFamily:'monospace',color:T.text,background:T.inputBg,padding:'14px 10px',borderRadius:12,marginBottom:12,letterSpacing:'3px',border:`1px solid ${T.border}`}}>
                      {fmt(timeLeft>0?timeLeft:timerMinutes*60)}
                    </div>
                    {!isRunning&&timeLeft===0&&(
                      <select value={timerMinutes} onChange={e=>setTimerMinutes(parseInt(e.target.value))} style={{background:T.inputBg,border:`1px solid ${T.border}`,borderRadius:8,padding:'7px 10px',color:T.text,fontSize:12,marginBottom:10,width:'100%'}}>
                        {[5,10,15,20,25,30].map(m=><option key={m} value={m}>{m} minutes</option>)}
                      </select>
                    )}
                    <div style={{display:'flex',gap:6,justifyContent:'center',marginBottom:14}}>
                      <button onClick={isRunning?pauseTimer:startTimer} style={{padding:'8px 22px',background:isRunning?T.amber:T.green,border:'none',borderRadius:20,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>{isRunning?'pause':'start'}</button>
                      <button onClick={resetTimer} style={{padding:'8px 14px',background:'transparent',border:`1px solid ${T.border}`,borderRadius:20,color:T.muted,fontSize:12,cursor:'pointer'}}>reset</button>
                    </div>
                    <div style={{textAlign:'left'}}>
                      <div style={{fontSize:9,color:T.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>related worries</div>
                      <div style={{maxHeight:140,overflowY:'auto'}}>
                        {topicMap[activeTopic]?.worries.slice(0,4).map(w=>(
                          <div key={w.id} style={{fontSize:11,color:T.muted,padding:'5px 0',borderBottom:`1px solid ${T.divider}`,lineHeight:1.5}}>"{w.text.length>72?w.text.slice(0,72)+'...':w.text}"</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ):<div style={{fontSize:12,color:T.muted,textAlign:'center',paddingTop:10}}>select a concern above to start focusing</div>}
              </>
            )}
          </div>
        </div>

        {/* ROW 3 — Reminders */}
        <div style={card}>
          <div style={secLabel}>scheduled nudges & reminders</div>
          <RemindersTab userEmail={userEmail||user?.email} onEmailSave={em=>{setUserEmail(em);setNudgeEmail(em);localStorage.setItem('3b_email',em)}}/>
        </div>

      </main>
    </div>
  )
}