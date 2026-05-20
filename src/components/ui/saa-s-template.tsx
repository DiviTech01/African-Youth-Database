import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const SaaSHero = React.memo(() => {
  return (
    <section className="relative py-16 md:py-24 bg-black overflow-hidden">
      {/* Grid BG - matching hero */}
      <div
        className="absolute inset-0 opacity-30 h-full w-full
        bg-[linear-gradient(to_right,#333_1px,transparent_1px),linear-gradient(to_bottom,#333_1px,transparent_1px)]
        bg-[size:6rem_5rem]
        [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_30%,transparent_100%)]"
      />

      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-white/[0.04] to-transparent rounded-full blur-3xl" />

      <div className="container px-4 md:px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Heading */}
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tighter
            bg-gradient-to-br from-[#D4A017] from-10% via-white via-40% to-white/40
            bg-clip-text text-transparent"
          >
            Data-driven insights for{" "}
            <br className="hidden sm:block" />
            Africa's next generation
          </h2>

          {/* Subtitle */}
          <p className="text-sm md:text-base text-[#A89070] max-w-2xl mx-auto leading-relaxed">
            Comprehensive youth statistics across all 54 African nations.
            Explore, compare, and export trusted data for policy, research, and impact.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link to="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto tracking-tight gap-2">
                Start Exploring
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/youth-index" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto tracking-tight border-gray-700 text-gray-300 hover:text-white hover:border-gray-500"
              >
                View Youth Index
              </Button>
            </Link>
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className="w-full max-w-5xl mx-auto mt-14 md:mt-20 relative">
          {/* Glow behind image */}
          <div className="absolute -inset-4 bg-gradient-to-r from-green-500/10 via-blue-500/10 to-purple-500/10 rounded-2xl blur-2xl opacity-60" />

          <div className="relative rounded-xl border border-gray-800 overflow-hidden shadow-2xl shadow-black/50">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=675&fit=crop&q=80"
              alt="AYO Analytics Dashboard showing youth data insights across African nations"
              className="w-full h-auto"
              loading="eager"
            />
            {/* Bottom fade */}
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
});

SaaSHero.displayName = "SaaSHero";

export default SaaSHero;
