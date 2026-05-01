'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const statusLabel: Record<string,string> = {submitted:'Yeni',read:'Okundu',in_production:'Üretimde',revision:'Revizyon',approved:'Onaylandı',delivered:'Teslim Edildi',cancelled:'İptal'}
const statusColor: Record<string,string> = {submitted:'#1db81d',read:'#888',in_production:'#f59e0b',revision:'#e24b4a',approved:'#1db81d',delivered:'#888',cancelled:'#555'}

export default function BriefsPage() {
  const router = useRouter()
  const [briefs, setBriefs] = useState<any[]>([])
  const [creators, setCreators] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkCreator, setBulkCreator] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [producerBriefs, setProducerBriefs] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data } = await supabase.from('briefs').select('*, clients(company_name)').is('parent_brief_id', null).eq('brief_type', 'primary').order('created_at', { ascending: false })
    setBriefs(data || [])
    const { data: c } = await supabase.from('creators').select('*, users(name)').eq('is_active', true)
    setCreators(c || [])
    const { data: pb } = await supabase.from('producer_briefs').select('brief_id, assigned_creator_id')
    setProducerBriefs(pb || [])
  }

  function getCreatorId(briefId: string) {
    return producerBriefs.find(pb => pb.brief_id === briefId)?.assigned_creator_id || ''
  }
  function getCreatorName(briefId: string) {
    const cid = getCreatorId(briefId)
    if (!cid) return ''
    return creators.find(c => c.id === cid)?.users?.name || ''
  }

  const filtered = briefs.filter(b => {
    if (filter !== 'all' && b.status !== filter) return false
    if (search && !b.campaign_name?.toLowerCase().includes(search.toLowerCase()) && !b.clients?.company_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (dateFrom && b.created_at < dateFrom) return false
    if (dateTo && b.created_at > dateTo + 'T23:59:59') return false
    if (creatorFilter && getCreatorId(b.id) !== creatorFilter) return false
    return true
  })

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(b => b.id)))
  }

  async function applyBulk() {
    if (selected.size === 0) return
    setBulkLoading(true)
    const ids = [...selected]
    if (bulkStatus) {
      for (const id of ids) await supabase.from('briefs').update({ status: bulkStatus }).eq('id', id)
    }
    if (bulkCreator) {
      for (const id of ids) {
        await supabase.from('producer_briefs').delete().eq('brief_id', id)
        await supabase.from('producer_briefs').insert({ brief_id: id, assigned_creator_id: bulkCreator, forwarded_at: new Date().toISOString() })
        if (bulkStatus !== 'in_production') await supabase.from('briefs').update({ status: 'in_production' }).eq('id', id)
      }
    }
    setSelected(new Set())
    setBulkStatus('')
    setBulkCreator('')
    setBulkLoading(false)
    loadData()
  }

  function clearFilters() { setFilter('all'); setSearch(''); setDateFrom(''); setDateTo(''); setCreatorFilter('') }

  return (
    <div style={{padding:'48px'}}>
        <h1 style={{fontSize:'28px',fontWeight:'300',letterSpacing:'-1px',margin:'0 0 20px'}}>Briefler</h1>

        {/* SEARCH + FILTERS */}
        <div style={{display:'flex',gap:'10px',marginBottom:'12px',flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Kampanya veya marka ara..."
            style={{padding:'8px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'13px',width:'220px',color:'#0a0a0a'}} />
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{padding:'8px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a'}} />
          <span style={{fontSize:'11px',color:'rgba(255,255,255,0.4)'}}>—</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{padding:'8px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a'}} />
          <select value={creatorFilter} onChange={e=>setCreatorFilter(e.target.value)} style={{padding:'8px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a',background:'#fff'}}>
            <option value="">Tüm Creator'lar</option>
            {creators.map(c=><option key={c.id} value={c.id}>{c.users?.name}</option>)}
          </select>
          {(search||dateFrom||dateTo||creatorFilter||filter!=='all') && (
            <button onClick={clearFilters} style={{padding:'8px 14px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'11px',color:'rgba(255,255,255,0.4)',background:'#fff',cursor:'pointer'}}>Filtreleri Temizle</button>
          )}
        </div>

        {/* STATUS TABS */}
        <div style={{display:'flex',gap:'8px',marginBottom:'20px',flexWrap:'wrap'}}>
          {[{val:'all',label:'Tümü'},{val:'submitted',label:'Yeni'},{val:'in_production',label:'Üretimde'},{val:'revision',label:'Revizyon'},{val:'approved',label:'Onay'},{val:'delivered',label:'Teslim'}].map(f=>(
            <button key={f.val} onClick={()=>setFilter(f.val)}
              style={{padding:'6px 16px',borderRadius:'100px',border:'1px solid',borderColor:filter===f.val?'#0a0a0a':'#e8e7e3',background:filter===f.val?'#0a0a0a':'#fff',color:filter===f.val?'#fff':'#888',fontSize:'12px',cursor:'pointer'}}>
              {f.label}
            </button>
          ))}
        </div>

        {/* BULK ACTIONS */}
        {selected.size > 0 && (
          <div style={{display:'flex',gap:'10px',marginBottom:'16px',padding:'12px 16px',background:'#fff',border:'1px solid #e8e7e3',borderRadius:'10px',alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',color:'#0a0a0a',fontWeight:'500'}}>{selected.size} seçili</span>
            <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a',background:'#fff'}}>
              <option value="">Status Değiştir</option>
              {['submitted','in_production','revision','approved','delivered','cancelled'].map(s=><option key={s} value={s}>{statusLabel[s]||s}</option>)}
            </select>
            <select value={bulkCreator} onChange={e=>setBulkCreator(e.target.value)} style={{padding:'7px 10px',border:'1px solid #e8e7e3',borderRadius:'8px',fontSize:'12px',color:'#0a0a0a',background:'#fff'}}>
              <option value="">Creator Ata</option>
              {creators.map(c=><option key={c.id} value={c.id}>{c.users?.name}</option>)}
            </select>
            <button onClick={applyBulk} disabled={bulkLoading||(!bulkStatus&&!bulkCreator)} style={{padding:'7px 16px',background:'#0a0a0a',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontWeight:'500',opacity:!bulkStatus&&!bulkCreator?0.4:1}}>
              {bulkLoading?'Uygulanıyor...':'Uygula'}
            </button>
            <button onClick={async()=>{
              if(!confirm(`${selected.size} brief kalıcı olarak silinecek. Bu işlem geri alınamaz. Emin misiniz?`)) return
              setBulkLoading(true)
              for(const id of Array.from(selected)) await supabase.from('briefs').delete().eq('id',id)
              setBriefs(prev=>prev.filter(b=>!selected.has(b.id)))
              setSelected(new Set())
              setBulkLoading(false)
            }} disabled={bulkLoading} style={{padding:'7px 16px',background:'#ef4444',color:'#fff',border:'none',borderRadius:'8px',fontSize:'12px',cursor:'pointer',fontWeight:'500'}}>
              Seçilenleri Sil ({selected.size})
            </button>
          </div>
        )}

        {/* TABLE */}
        <div style={{background:'#fff',border:'1px solid #e8e7e3',borderRadius:'12px',overflow:'hidden'}}>
          {filtered.length === 0 ? (
            <div style={{padding:'48px',textAlign:'center',color:'rgba(255,255,255,0.4)',fontSize:'14px'}}>Brief yok.</div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid #e8e7e3'}}>
                  <th style={{padding:'12px 16px',width:'32px'}}>
                    <input type="checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={toggleAll} style={{accentColor:'#22c55e'}} />
                  </th>
                  {['Kampanya','Marka','Video Tipi','Durum','Tarih'].map(h=>(
                    <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:'11px',color:'rgba(255,255,255,0.4)',letterSpacing:'0.5px',fontWeight:'400'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((brief,i)=>(
                  <tr key={brief.id} style={{borderBottom:i<filtered.length-1?'1px solid #f0f0ee':'none',cursor:'pointer'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='#fafaf8')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <td style={{padding:'12px 16px'}} onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(brief.id)} onChange={()=>toggleSelect(brief.id)} style={{accentColor:'#22c55e'}} />
                    </td>
                    <td onClick={()=>router.push(`/dashboard/admin/briefs/${brief.id}`)} style={{padding:'12px 16px'}}>
                      <div style={{fontSize:'14px',fontWeight:'500'}}>{brief.campaign_name}</div>
                      {getCreatorName(brief.id) ? <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#0a0a0a',fontWeight:'500',marginTop:'2px'}}>→ {getCreatorName(brief.id)}</div> : <div style={{fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',color:'#f5a623',marginTop:'2px'}}>ATANMADI</div>}
                    </td>
                    <td onClick={()=>router.push(`/dashboard/admin/briefs/${brief.id}`)} style={{padding:'12px 16px',fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{brief.clients?.company_name||'—'}</td>
                    <td onClick={()=>router.push(`/dashboard/admin/briefs/${brief.id}`)} style={{padding:'12px 16px',fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{brief.video_type}</td>
                    <td onClick={()=>router.push(`/dashboard/admin/briefs/${brief.id}`)} style={{padding:'12px 16px'}}>
                      <span style={{fontSize:'11px',padding:'3px 10px',borderRadius:'100px',background:`${statusColor[brief.status]||'#888'}15`,color:statusColor[brief.status]||'#888'}}>
                        {statusLabel[brief.status]||brief.status}
                      </span>
                    </td>
                    <td onClick={()=>router.push(`/dashboard/admin/briefs/${brief.id}`)} style={{padding:'12px 16px',fontSize:'13px',color:'rgba(255,255,255,0.4)'}}>{new Date(brief.created_at).toLocaleDateString('tr-TR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </div>
  )
}
