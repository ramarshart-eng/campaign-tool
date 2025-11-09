/**
 * Test page for SRD API integration
 * Visit /test/srd-api to verify API is working
 */

import React from "react";
import type { NextPage } from "next";
import { useRaces, useClasses, useBackgrounds } from "@/lib/hooks/useSRD";

const SRDApiTestPage: NextPage = () => {
  const races = useRaces();
  const classes = useClasses();
  const backgrounds = useBackgrounds();

  return (
    <main className="min-h-screen p-8 bg-white">
      <h1 className=" mb-8 border-b-2 border-black pb-2">
        SRD API Integration Test
      </h1>

      <div className="space-y-8">
        {/* Races */}
        <section>
          <h2 className=" mb-4">Races</h2>
          {races.loading && <p>Loading races...</p>}
          {races.error && (
            <p className="text-danger">Error: {races.error.message}</p>
          )}
          {races.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {races.data.map((race) => (
                <div key={race.index} className="frame pad-3">
                  <p className="">{race.name}</p>
                  <p className=" text-muted">{race.index}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Classes */}
        <section>
          <h2 className=" mb-4">Classes</h2>
          {classes.loading && <p>Loading classes...</p>}
          {classes.error && (
            <p className="text-danger">Error: {classes.error.message}</p>
          )}
          {classes.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {classes.data.map((cls) => (
                <div key={cls.index} className="frame pad-3">
                  <p className="">{cls.name}</p>
                  <p className=" text-muted">{cls.index}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Backgrounds */}
        <section>
          <h2 className=" mb-4">Backgrounds</h2>
          {backgrounds.loading && <p>Loading backgrounds...</p>}
          {backgrounds.error && (
            <p className="text-danger">Error: {backgrounds.error.message}</p>
          )}
          {backgrounds.data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {backgrounds.data.map((bg) => (
                <div key={bg.index} className="frame pad-3">
                  <p className="">{bg.name}</p>
                  <p className=" text-muted">{bg.index}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default SRDApiTestPage;
