"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";

export function Hero({ appUrl }: { appUrl: string }) {
  return (
    <Card className="relative w-full h-[520px] md:h-[600px] overflow-hidden border-neutral-900 bg-black/[0.96]">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />

      <div className="flex h-full">
        <div className="flex-1 p-6 sm:p-8 md:p-12 relative z-10 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-neutral-800 bg-neutral-900/60 px-3 py-1 text-xs text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Spend control for AI agents
          </div>

          <h1 className="mt-5 sm:mt-6 text-3xl sm:text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400 leading-tight">
            Don&rsquo;t trust your agent.
            <br />
            Trust the math.
          </h1>
          <p className="mt-4 sm:mt-6 text-neutral-300 max-w-lg text-base sm:text-lg">
            Rein is secure payments infrastructure for AI agents. Every
            action an agent takes is guardrailed by cryptography.
          </p>
          <div className="mt-6 sm:mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={appUrl}>Get started</a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent text-white border-neutral-700 hover:bg-neutral-900 hover:text-white"
            >
              <a href="#how">How it works</a>
            </Button>
          </div>
        </div>

        <div className="flex-1 relative hidden md:block">
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
      </div>
    </Card>
  );
}
