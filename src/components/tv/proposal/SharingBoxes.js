"use client";

/* Proposal screen 3 — the anchors.
 * Every box is priced under the sum of its parts and shows both numbers, so the
 * saving is legible rather than asserted. The Family Box keeps today's exact
 * price; the Wing Box replaces the 20-for-€15.30 pack that two Wicked Wings
 * already beat. */

import Image from "next/image";
import Shell from "./Shell";
import { BOXES, ORANGE, money } from "./data";

export default function SharingBoxes() {
  return (
    <Shell
      step={3}
      title="Or go big"
      hint={
        <>
          Sharing boxes — <b>everything included</b>
        </>
      }
    >
      <style jsx global>{`
        .bwrap {
          flex: 1;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          padding: 24px 44px 44px;
          min-height: 0;
        }
        .bcard {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 22px;
          overflow: hidden;
          border: 2px solid #2e2e2e;
          background: #141414;
        }
        .bcard.hero { border-color: ${ORANGE}; animation: bGlow 6s ease-in-out infinite; }
        @keyframes bGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(255,160,0,0); }
          50%      { box-shadow: 0 0 40px rgba(255,160,0,0.4); }
        }

        .bphoto { position: relative; flex: 1 1 auto; min-height: 290px; overflow: hidden; }
        .bscrim {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(to top, #141414 2%, rgba(20,20,20,0.35) 55%, transparent);
        }
        .bfeeds {
          position: absolute;
          top: 14px; left: 14px;
          z-index: 2;
          background: ${ORANGE};
          color: #141414;
          font-weight: 800;
          font-size: 19px;
          line-height: 1;
          letter-spacing: 0.05em;
          padding: 9px 15px;
          border-radius: 999px;
        }

        .bbody {
          flex: 0 0 auto;
          display: flex;
          flex-direction: column;
          padding: 0 22px 22px;
          margin-top: -34px;
          position: relative;
          z-index: 2;
          min-height: 0;
        }
        .bname {
          font-family: 'Bebas Neue', cursive;
          font-size: 46px;
          line-height: 1;
          color: #fff;
          margin: 0 0 12px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .bcontents { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 5px; }
        .bcontents li {
          font-size: 22px;
          font-weight: 600;
          color: #cfc8c1;
          line-height: 1.25;
        }
        .bcontents li::before { content: "› "; color: ${ORANGE}; font-weight: 800; }

        .bnote {
          margin: 12px 0 0;
          font-size: 17px;
          font-weight: 700;
          color: #7d766f;
          font-style: italic;
        }

        .bfoot { margin-top: auto; padding-top: 16px; display: flex; align-items: baseline; gap: 12px; }
        .bprice {
          font-family: 'Bebas Neue', cursive;
          font-size: 62px;
          line-height: 1;
          color: ${ORANGE};
          letter-spacing: 0.02em;
        }
        .bwas {
          font-size: 22px;
          font-weight: 700;
          color: #6f6862;
          text-decoration: line-through;
        }
        .bsave {
          margin-left: auto;
          background: rgba(255,160,0,0.14);
          border: 1px solid rgba(255,160,0,0.45);
          color: ${ORANGE};
          font-weight: 800;
          font-size: 19px;
          padding: 7px 13px;
          border-radius: 999px;
          white-space: nowrap;
        }
      `}</style>

      <div className="bwrap">
        {BOXES.map((box, i) => {
          const save = Math.round(((box.was - box.price) / box.was) * 100);
          return (
            <div className={`bcard${box.hero ? " hero" : ""}`} key={box.name}>
              <div className="bphoto">
                <div className={`pkb${i % 2 ? " alt" : ""}`}>
                  <Image
                    src={box.image}
                    alt={box.name}
                    fill
                    sizes="25vw"
                    quality={80}
                    priority={i < 2}
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="bscrim" />
                <span className="bfeeds">★ FEEDS {box.feeds}</span>
              </div>
              <div className="bbody">
                <h2 className="bname">{box.name}</h2>
                <ul className="bcontents">
                  {box.contents.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                {box.note && <p className="bnote">{box.note}</p>}
                <div className="bfoot">
                  <span className="bprice">{money(box.price)}</span>
                  <span className="bwas">{money(box.was)}</span>
                  <span className="bsave">SAVE {save}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
