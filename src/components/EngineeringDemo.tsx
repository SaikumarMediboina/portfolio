import { useState } from "react";

const examples = [
  { query: "How was batch screening made faster?", source: "High-Volume Batch Processing", retrieval: "Aggregated queries · targeted indexing · parallel processing", answer: "The project removed N+1 access patterns, added targeted indexes and improved parallel processing. The portfolio reports a 5K batch improving from 125 minutes to 3 minutes.", project: 3 },
  { query: "How do AI signals and matching rules work together?", source: "Advanced Hybrid Scoring Engine", retrieval: "AI similarity · exact and fuzzy matching · configurable rules", answer: "A configurable scoring microservice combines AI similarity with deterministic matching rules to rank noisy watchlist records. The portfolio describes improved relevance without publishing a precision/recall benchmark.", project: 2 },
  { query: "How was real-time screening optimized?", source: "Real-Time Screening Optimization", retrieval: "Dedicated thread pools · parallel database work · incremental results", answer: "The screening path parallelizes database work and streams results incrementally. The portfolio reports latency improving from roughly 2 seconds to 300 milliseconds; the percentile is not specified.", project: 4 },
];
const stages = ["Backend", "Search", "AI response"];
export default function EngineeringDemo() {
  const [example, setExample] = useState(0);
  const [stage, setStage] = useState(0);
  const item = examples[example];
  return (
    <section className="home-section shell engineering-demo" aria-labelledby="engineering-demo-title">
      <div className="studio-section-title"><div><p className="eyebrow">Inside the workflow</p><h2 id="engineering-demo-title">From question to grounded answer.</h2></div></div>
      <p className="demo-disclosure">Interactive illustration using local examples. No live search, model calls or personal data are sent.</p>
      <label htmlFor="demo-question">Choose a question</label>
      <select id="demo-question" value={example} onChange={(event) => { setExample(Number(event.target.value)); setStage(0); }}>
        {examples.map((entry, index) => <option key={entry.query} value={index}>{entry.query}</option>)}
      </select>
      <div className="demo-stages" aria-label="Workflow stages">
        {stages.map((name, index) => <button type="button" key={name} aria-pressed={stage === index} onClick={() => setStage(index)}><span>0{index + 1}</span>{name}<small>{["Validate the question", "Retrieve supporting context", "Answer with a source"][index]}</small></button>)}
      </div>
      <div className="demo-output" aria-live="polite" aria-atomic="true">
        <p className="eyebrow">{stages[stage]}</p>
        <h3>{["Accept a focused request.", "Find context before generating.", "Keep the answer tied to evidence."][stage]}</h3>
        <p>{stage === 0 ? `The backend receives “${item.query}”. In this illustration, it passes the selected question to the retrieval step.` : stage === 1 ? `Selected context: ${item.source}. Relevant details: ${item.retrieval}.` : item.answer}</p>
        {stage === 2 ? <a href={`/portfolio?project=${item.project}#work`}>Source: {item.source} ↗</a> : <button type="button" className="button button-secondary" onClick={() => setStage(stage + 1)}>Next: {stages[stage + 1]} →</button>}
      </div>
    </section>
  );
}
