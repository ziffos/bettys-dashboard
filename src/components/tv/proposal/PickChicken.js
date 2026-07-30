"use client";

/* Proposal screen 1 — pick your chicken, by the piece.
 * The customer still chooses how many; the ladder means it is one glance
 * instead of arithmetic, and per-piece gets cheaper as it goes down. */

import Image from "next/image";
import Shell from "./Shell";
import { CHICKEN, MIX_BOX, ORANGE, money } from "./data";

function Panel({ item, i }) {
  const perPiece = item.ladder
    ? item.ladder[item.ladder.length - 1].price / item.ladder[item.ladder.length - 1].pcs
    : null;
  return (
    <div className="cpanel">
      <div className={`pkb${i % 2 ? " alt" : ""}`}>
        <Image
          src={item.image}
          alt={item.name}
          fill
          sizes="25vw"
          quality={80}
          priority={i === 0}
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="cscrim" />

      <div className="ctop">
        <h2 className="cname">{item.name}</h2>
        <p className="cblurb">{item.blurb}</p>
      </div>

      <div className="cbottom">
        {item.ladder ? (
          <>
            <div className="cladder">
              {item.ladder.map((r) => (
                <div className="crow" key={r.pcs}>
                  <span className="cpcs">
                    {r.pcs} <em>pcs</em>
                  </span>
                  <span className="cdots" />
                  <span className="cprice">{money(r.price)}</span>
                </div>
              ))}
            </div>
            {perPiece && (
              <p className="cfrom">from {money(perPiece)} a piece</p>
            )}
          </>
        ) : (
          <div className="cbig">
            <span className="ppill cbigpill">{money(item.price)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PickChicken() {
  const panels = [...CHICKEN, MIX_BOX];
  return (
    <Shell
      step={1}
      title="Pick your chicken"
      hint={
        <>
          Choose how many.
          <br />
          Then <b>add a meal</b> →
        </>
      }
    >
      <style jsx global>{`
        .cpanel {
          position: relative;
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-left: 5px solid #0d0d0d;
        }
        .cpanel:first-child { border-left: 0; }
        .cscrim {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.28) 32%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.95) 82%);
        }
        .ctop { position: relative; z-index: 2; padding: 26px 26px 0; text-align: center; }
        .cname {
          font-family: 'Bebas Neue', cursive;
          font-size: 46px;
          line-height: 1;
          color: #fff;
          margin: 0;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .cblurb {
          font-size: 20px;
          font-weight: 600;
          color: #b8b0a8;
          margin: 8px 0 0;
        }

        .cbottom {
          position: relative;
          z-index: 2;
          margin-top: auto;
          padding: 0 26px 40px;
        }
        .cladder { display: flex; flex-direction: column; gap: 9px; }
        .crow { display: flex; align-items: baseline; gap: 10px; }
        .cpcs {
          font-family: 'Bebas Neue', cursive;
          font-size: 40px;
          line-height: 1;
          color: #fff;
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .cpcs em {
          font-family: 'Nunito', sans-serif;
          font-style: normal;
          font-size: 19px;
          font-weight: 700;
          color: #9a938c;
          margin-left: 2px;
        }
        .cdots {
          flex: 1;
          border-bottom: 2px dotted #4a443e;
          transform: translateY(-6px);
        }
        .cprice {
          font-family: 'Bebas Neue', cursive;
          font-size: 40px;
          line-height: 1;
          color: ${ORANGE};
          letter-spacing: 0.02em;
          white-space: nowrap;
        }
        .cfrom {
          margin: 14px 0 0;
          font-size: 19px;
          font-weight: 700;
          color: #8a8178;
          text-align: center;
        }

        .cbig { display: flex; justify-content: center; padding-bottom: 8px; }
        .cbigpill { font-size: 58px; padding: 14px 34px 10px; }
      `}</style>

      {panels.map((item, i) => (
        <Panel key={item.name} item={item} i={i} />
      ))}
    </Shell>
  );
}
