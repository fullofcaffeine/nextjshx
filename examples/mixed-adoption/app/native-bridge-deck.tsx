"use client";

import { useState } from "react";

import { Badge } from "@nextjshx/showcase-ui/badge";
import { Button } from "@nextjshx/showcase-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nextjshx/showcase-ui/card";

// Generated adapter paths are manifest-owned. The verification harness locks
// their identities and proves init never claims this native module.
import HaxePatchConsole from "./_nextjshx/client/c7daa5458af6/HaxePatchConsole";
import { useBridgeChannel } from "./_nextjshx/hook/4aa28d4a55e4/useBridgeChannel";
import { haxeInteropLabel } from "../src-gen/index";

export function NativeBridgeDeck() {
  const channel = useBridgeChannel(["native route", "Haxe component", "typed Hook"]);
  const [checks, setChecks] = useState(3);

  return (
    <section id="bridge" className="bridge-section">
      <div className="section-rail">
        <span>LIVE PATCH / TS → HX</span>
        <strong>three typed crossings</strong>
      </div>
      <div className="bridge-grid">
        <Card className="bridge-card native-card">
          <CardHeader>
            <Badge className="owner-badge">TSX owns this shell</Badge>
            <CardTitle>{haxeInteropLabel("north channel")}</CardTitle>
            <CardDescription>
              Native React consumes a Haxe-authored component, generic Hook,
              and ordinary exposed function.
            </CardDescription>
          </CardHeader>
          <CardContent className="native-controls">
            <div className="channel-readout" aria-live="polite">
              <span>selected line</span>
              <strong>{channel.items[channel.index]}</strong>
            </div>
            <div className="button-row">
              {channel.items.map((item, index) => (
                <Button
                  key={item}
                  type="button"
                  variant={index === channel.index ? "default" : "outline"}
                  onClick={() => channel.select(index)}
                >
                  {String(index + 1).padStart(2, "0")}
                </Button>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={() => setChecks((value) => value + 1)}>
              Run native check · {checks}
            </Button>
          </CardContent>
        </Card>

        <HaxePatchConsole
          label="Haxe client component / imported by TSX"
          initialLevel={68}
          accent="vermilion"
        />
      </div>
    </section>
  );
}
