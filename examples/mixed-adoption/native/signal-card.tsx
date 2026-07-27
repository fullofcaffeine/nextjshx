"use client";

import type { ReactNode } from "react";

import { Badge } from "@nextjshx/showcase-ui/badge";
import { Button } from "@nextjshx/showcase-ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@nextjshx/showcase-ui/card";

export interface NativeSignalCardProps {
  readonly channel: "alpha" | "beta";
  readonly label: string;
  readonly reading: string;
  readonly band: "quiet" | "nominal" | "hot";
  readonly onCalibrate: () => void;
  readonly children?: ReactNode;
}

export function NativeSignalCard(props: NativeSignalCardProps) {
  return (
    <Card className="bridge-card signal-card" data-band={props.band}>
      <CardHeader>
        <Badge variant="outline" className="owner-badge">
          native TSX component / channel {props.channel}
        </Badge>
        <CardTitle>{props.label}</CardTitle>
        <CardDescription>
          Rendered by source-owned React; props and callback supplied by Haxe.
        </CardDescription>
      </CardHeader>
      <CardContent className="signal-card-content">
        <strong className="signal-reading">{props.reading}</strong>
        <div className="signal-scale" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <Button type="button" variant="outline" onClick={props.onCalibrate}>
          Calibrate from Haxe
        </Button>
        {props.children}
      </CardContent>
    </Card>
  );
}
