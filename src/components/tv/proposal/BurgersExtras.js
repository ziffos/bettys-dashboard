"use client";

/* Proposal screen 4 — everything that isn't chicken by the piece.
 * Same +meal rule as screens 1-2, stated once at the top so the customer only
 * ever learns one mechanic. */

import Image from "next/image";
import Shell from "./Shell";
import {
  DIPS,
  DRINKS_ALACARTE,
  MEAL_UPGRADE,
  ORANGE,
  SANDWICHES,
  SIDES_ALACARTE,
  money,
} from "./data";

export default function BurgersExtras() {
  const featured = SANDWICHES.filter((s) => s.image).slice(0, 3);
  return (
    <Shell
      step={4}
      title="Burgers, wraps & extras"
      hint={
        <>
          Any of these <b>+{money(MEAL_UPGRADE)}</b> for a meal
        </>
      }
    >
      <style jsx global>{`
        .ewrap {
          flex: 1;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 32px;
          padding: 22px 44px 44px;
          min-height: 0;
        }
        .ecol { display: flex; flex-direction: column; min-height: 0; }

        .ecat {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin: 0 0 12px;
        }
        .ecat h3 {
          font-family: 'Bebas Neue', cursive;
          font-size: 44px;
          line-height: 1;
          color: #fff;
          margin: 0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-left: 4px solid ${ORANGE};
          padding-left: 13px;
        }
        .ecat span { font-size: 20px; font-weight: 700; color: #8a8178; }

        .erow {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 16px;
          padding: 9px 0;
          border-bottom: 1px solid #1e1e1e;
        }
        .ename { font-size: 29px; font-weight: 700; color: #e4ded8; margin: 0; }
        .eprice {
          font-family: 'Bebas Neue', cursive;
          font-size: 38px;
          line-height: 1;
          color: ${ORANGE};
          margin: 0;
          white-space: nowrap;
        }
        .emeal { font-size: 19px; font-weight: 700; color: #7d766f; margin-left: 8px; }

        .esection { margin-top: 22px; }

        /* Photo strip so the board isn't a wall of text */
        .estrip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: auto; padding-top: 20px; }
        .eshotWrap { display: contents; }
        .eshot {
          position: relative;
          height: 250px;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #2a2a2a;
        }
        .eshotScrim {
          position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(to top, rgba(0,0,0,0.9) 8%, transparent 65%);
        }
        .eshotName {
          position: absolute;
          left: 14px; right: 14px; bottom: 12px;
          z-index: 2;
          font-family: 'Bebas Neue', cursive;
          font-size: 27px;
          line-height: 1.05;
          color: #fff;
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .echips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
        .echip {
          background: #191919;
          border: 1px solid #2e2e2e;
          color: #d9d4cf;
          font-weight: 700;
          font-size: 22px;
          line-height: 1;
          padding: 11px 17px;
          border-radius: 999px;
        }
      `}</style>

      <div className="ewrap">
        {/* Left: sandwiches + photos */}
        <div className="ecol">
          <div className="ecat">
            <h3>Burgers &amp; Wraps</h3>
            <span>+{money(MEAL_UPGRADE)} makes any of them a meal</span>
          </div>
          <div>
            {SANDWICHES.map((s) => (
              <div className="erow" key={s.name}>
                <p className="ename">{s.name}</p>
                <p className="eprice">
                  {money(s.price)}
                  <span className="emeal">
                    meal {money(s.price + MEAL_UPGRADE)}
                  </span>
                </p>
              </div>
            ))}
          </div>

          <div className="estrip">
            {featured.map((s, i) => (
              <div className="eshot" key={s.name}>
                <div className={`pkb${i % 2 ? " alt" : ""}`}>
                  <Image
                    src={s.image}
                    alt={s.name}
                    fill
                    sizes="20vw"
                    quality={78}
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div className="eshotScrim" />
                <p className="eshotName">{s.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: sides, dips, drinks */}
        <div className="ecol">
          <div className="ecat">
            <h3>Sides</h3>
            <span>on their own</span>
          </div>
          <div>
            {SIDES_ALACARTE.map((s) => (
              <div className="erow" key={s.name}>
                <p className="ename">{s.name}</p>
                <p className="eprice">{money(s.price)}</p>
              </div>
            ))}
          </div>

          <div className="esection">
            <div className="ecat">
              <h3>Dips</h3>
              <span>{money(DIPS.price)} each</span>
            </div>
            <div className="echips">
              {DIPS.items.map((d) => (
                <span className="echip" key={d}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="esection">
            <div className="ecat">
              <h3>Drinks</h3>
            </div>
            <div>
              {DRINKS_ALACARTE.map((d) => (
                <div className="erow" key={d.name}>
                  <p className="ename">{d.name}</p>
                  <p className="eprice">{money(d.price)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
