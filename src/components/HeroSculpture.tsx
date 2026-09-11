import { useRef, type PointerEvent } from "react";
import "./HeroSculpture.css";

/** Decorative CSS geometry: no WebGL runtime or downloaded model. */
export default function HeroSculpture() {
  const scene = useRef<HTMLDivElement>(null);
  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    scene.current?.style.setProperty("--pitch", `${-18 - ((event.clientY - bounds.top) / bounds.height - 0.5) * 16}deg`);
    scene.current?.style.setProperty("--yaw", `${28 + ((event.clientX - bounds.left) / bounds.width - 0.5) * 24}deg`);
  }
  function reset() {
    scene.current?.style.removeProperty("--pitch");
    scene.current?.style.removeProperty("--yaw");
  }
  return (
    <div className="hero-sculpture" ref={scene} onPointerMove={move} onPointerLeave={reset} aria-hidden="true">
      <div className="hero-sculpture-shadow" />
      <div className="hero-sculpture-cube">
        <span className="sculpture-front">SK</span>
        <span className="sculpture-back" />
        <span className="sculpture-right">&lt;/&gt;</span>
        <span className="sculpture-left" />
        <span className="sculpture-top" />
        <span className="sculpture-bottom" />
      </div>
      <span className="hero-sculpture-caption">ENGINEER · BUILDER · EXPLORER</span>
    </div>
  );
}
