import { useState } from "react";
import type { ExpenseEntry, ExpenseMember } from "./firestore";

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value / 100);
const label = (month: string) => { const [y,m] = month.split("-").map(Number); return new Intl.DateTimeFormat("en-IN", {month:"short",year:"numeric"}).format(new Date(y,m-1,1)); };
const days = (month: string) => {const [y,m]=month.split("-").map(Number);return new Date(y,m,0).getDate();};
export function comparisonEntries(entries: ExpenseEntry[], month: string, categories: string[], payer: string, cutoff: number) {
  return entries.filter(e=>e.expenseDate.startsWith(month+"-") && Number(e.expenseDate.slice(8,10))<=cutoff && (!categories.length || categories.includes(e.categoryName)) && (payer==="all" || e.paidByUid===payer));
}
export function changeLabel(before:number,after:number){ if(before===after)return "No change";if(before===0)return "New spending";return `${after>before?"↑":"↓"} ${(Math.abs(after-before)/before*100).toFixed(1)}%`; }
export default function ExpenseCompare({entries,members,shared}:{entries:ExpenseEntry[];members:ExpenseMember[];shared:boolean}){
 const now=new Date(),current=now.toISOString().slice(0,7),previous=new Date(now.getFullYear(),now.getMonth()-1,1);const previousMonth=`${previous.getFullYear()}-${String(previous.getMonth()+1).padStart(2,"0")}`;
 const [first,setFirst]=useState(previousMonth),[second,setSecond]=useState(current),[mode,setMode]=useState("same"),[categories,setCategories]=useState<string[]>([]),[payer,setPayer]=useState("all");
 const cutoff=mode==="same"?Math.min(days(first),days(second),first===current||second===current?Number(now.toISOString().slice(8,10)):31):31;
 const before=comparisonEntries(entries,first,categories,payer,cutoff),after=comparisonEntries(entries,second,categories,payer,cutoff);
 const total=(items:ExpenseEntry[])=>items.reduce((sum,e)=>sum+e.amountPaise,0),a=total(before),b=total(after);
 const allCategories=[...new Set(entries.map(e=>e.categoryName))].sort();
 const rows=[...new Set([...before,...after].map(e=>e.categoryName))].map(name=>({name,a:total(before.filter(e=>e.categoryName===name)),b:total(after.filter(e=>e.categoryName===name))})).sort((x,y)=>y.a+y.b-x.a-x.b);
 const max=Math.max(1,...rows.flatMap(r=>[r.a,r.b]));
 return <section className="expense-compare" aria-label="Month comparison">
  <div className="expense-panel-heading"><div><p className="expense-eyebrow">Month to month</p><h2>See what changed.</h2></div></div>
  <div className="expense-compare-controls">
   <label>First month<input type="month" value={first} max={current} onChange={e=>e.target.value&&setFirst(e.target.value)}/></label>
   <label>Second month<input type="month" value={second} max={current} onChange={e=>e.target.value&&setSecond(e.target.value)}/></label>
   <label>Compare period<select value={mode} onChange={e=>setMode(e.target.value)}><option value="same">Same dates</option><option value="full">Full month</option></select></label>
   {shared&&<label>Paid by<select value={payer} onChange={e=>setPayer(e.target.value)}><option value="all">Household</option>{members.map(m=><option value={m.id} key={m.id}>{m.displayName}</option>)}</select></label>}
  </div>
  <p className="expense-compare-note">{mode==="same"?`Comparing days 1–${cutoff} in both months.`:"Comparing all recorded expenses in each month. The current month may be incomplete."} {first===second?"Both selections are the same month.":""}</p>
  <div className="expense-category-filters" role="group" aria-label="Compare categories"><button type="button" aria-pressed={!categories.length} onClick={()=>setCategories([])}>All categories</button>{allCategories.map(name=><button type="button" key={name} aria-pressed={categories.includes(name)} onClick={()=>setCategories(old=>old.includes(name)?old.filter(n=>n!==name):[...old,name])}>{name}</button>)}</div>
  <div className="expense-comparison-totals" aria-live="polite"><div><span>{label(first)}</span><strong>{money(a)}</strong><small>{before.length} expenses</small></div><div><span>{label(second)}</span><strong>{money(b)}</strong><small>{after.length} expenses</small></div><div><span>Difference</span><strong>{b===a?money(0):`${b>a?"+":"−"}${money(Math.abs(b-a))}`}</strong><small>{changeLabel(a,b)}</small></div></div>
  <div className="expense-comparison-legend"><span><i/> {label(first)}</span><span><i/> {label(second)}</span></div>
  {rows.length?rows.map(row=><details className="expense-comparison-row" key={row.name}>
   <summary><div className="expense-comparison-row-title"><strong>{row.name}</strong><span>{changeLabel(row.a,row.b)} · {row.a===row.b?money(0):`${row.b>row.a?"+":"−"}${money(Math.abs(row.b-row.a))}`}</span></div><div className="expense-compare-bars">{[row.a,row.b].map((value,i)=><div key={i}><span>{label(i?second:first)}</span><div className="expense-compare-track"><i style={{width:`${value/max*100}%`}}/></div><strong>{money(value)}</strong></div>)}</div><small>View expenses ↓</small></summary>
   <div className="expense-comparison-details">{[before,after].map((items,i)=><section key={i}><h3>{label(i?second:first)}</h3>{items.filter(e=>e.categoryName===row.name).length?items.filter(e=>e.categoryName===row.name).sort((x,y)=>y.expenseDate.localeCompare(x.expenseDate)).map(e=><div key={e.id}><div><strong>{e.description}</strong><small>{e.expenseDate} · {e.paidByName}</small></div><span>{money(e.amountPaise)}</span></div>):<p>No expenses in this period.</p>}</section>)}</div>
  </details>):<div className="expense-empty-state"><h3>No spending to compare</h3><p>Try another month, category, or payer.</p></div>}
 </section>;
}
