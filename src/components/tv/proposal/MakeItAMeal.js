"use client";

/* Proposal screen 2 — the whole upsell is one number.
 * Deliberately sparse: one price, the two things it buys, and the dips. If a
 * customer only reads one screen in the queue, this is the profitable one. */

import Shell from "./Shell";
import { DIPS, MEAL_DRINKS, MEAL_SIDES, MEAL_UPGRADE, ORANGE, money } from "./data";

export default function MakeItAMeal() {
  return (
    <Shell
      step={2}
      title="Make it a meal"
      hint={
        <>
          One price, any chicken.
          <br />
          Per person.
        </>
      }
    >
      <style jsx global>{`
        .mwrap {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1.35fr;
          gap: 40px;
          padding: 26px 44px 44px;
          min-height: 0;
        }

        /* Left: the number */
        .mprice {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          background: linear-gradient(160deg, #1c1710 0%, #141414 70%);
          border: 3px solid ${ORANGE};
          border-radius: 26px;
          padding: 30px;
          animation: mGlow 6s ease-in-out infinite;
        }
        @keyframes mGlow {
          0%, 100% { box-shadow: 0 0 0 rgba(255,160,0,0); }
          50%      { box-shadow: 0 0 46px rgba(255,160,0,0.35); }
        }
        .mplus {
          font-family: 'Bebas Neue', cursive;
          font-size: 210px;
          line-height: 0.86;
          color: ${ORANGE};
          margin: 0;
          letter-spacing: -0.01em;
        }
        .mgets { margin: 18px 0 0; }
        .mgetline {
          font-family: 'Bebas Neue', cursive;
          font-size: 52px;
          line-height: 1.1;
          color: #fff;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .mgetplus { color: ${ORANGE}; }
        .mnote {
          margin: 20px 0 0;
          font-size: 21px;
          font-weight: 700;
          color: #8a8178;
        }

        /* Right: what you can pick */
        .mcols { display: flex; flex-direction: column; gap: 22px; min-height: 0; }
        .mcard {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #141414;
          border: 1px solid #2a2a2a;
          border-radius: 20px;
          padding: 22px 26px;
        }
        .mcaption {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin: 0 0 14px;
        }
        .mcaption h3 {
          font-family: 'Bebas Neue', cursive;
          font-size: 42px;
          line-height: 1;
          color: #fff;
          margin: 0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-left: 4px solid ${ORANGE};
          padding-left: 13px;
        }
        .mcaption span { font-size: 20px; font-weight: 700; color: #8a8178; }

        .mlist { display: flex; flex-wrap: wrap; gap: 10px 12px; }
        .mitem {
          display: inline-flex;
          align-items: baseline;
          gap: 8px;
          background: #1c1c1c;
          border: 1px solid #303030;
          border-radius: 999px;
          padding: 12px 20px;
          font-size: 25px;
          font-weight: 700;
          color: #e4ded8;
        }
        .msupp { font-size: 19px; font-weight: 800; color: ${ORANGE}; }

        .mdipwrap { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
      `}</style>

      <div className="mwrap">
        <div className="mprice">
          <p className="mplus">+{money(MEAL_UPGRADE).replace("€", "€")}</p>
          <div className="mgets">
            <div className="mgetline">Any side</div>
            <div className="mgetline mgetplus">+</div>
            <div className="mgetline">Any drink</div>
          </div>
          <p className="mnote">Add one per person</p>
        </div>

        <div className="mcols">
          <div className="mcard">
            <div className="mcaption">
              <h3>Pick a side</h3>
              <span>choose one</span>
            </div>
            <div className="mlist">
              {MEAL_SIDES.map((s) => (
                <span className="mitem" key={s.name}>
                  {s.name}
                  {s.supplement ? (
                    <em className="msupp">+{money(s.supplement)}</em>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="mcard">
            <div className="mcaption">
              <h3>Pick a drink</h3>
              <span>330ml</span>
            </div>
            <div className="mlist">
              {MEAL_DRINKS.map((d) => (
                <span className="mitem" key={d}>
                  {d}
                </span>
              ))}
            </div>
          </div>

          <div className="mcard">
            <div className="mcaption">
              <h3>Add a dip</h3>
              <span>{money(DIPS.price)} each</span>
            </div>
            <div className="mlist mdipwrap">
              {DIPS.items.map((d) => (
                <span className="mitem" key={d}>
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
