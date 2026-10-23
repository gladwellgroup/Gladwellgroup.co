import { Navbar } from "@/components/layout/navbar"
import { HeroSection } from "@/components/sections/hero-section"
import { HeroBackground } from "@/components/sections/hero-background"
import { PresentationSection } from "@/components/sections/presentation-section"
import { PillarsSection } from "@/components/sections/pillars-section"
import { VideoSection } from "@/components/sections/video-section"
import { GallerySection } from "@/components/sections/gallery-section"
import { TeamSection } from "@/components/sections/team-section"
import { Footer } from "@/components/layout/footer"
import { ContentBackground } from "@/components/layout/content-background"
import { WalkingListProvider } from "@/components/providers/walking-list-provider"

export default function Home() {
  return (
    <WalkingListProvider>
      <main>
        <Navbar />
        <HeroSection>
          <HeroBackground />
        </HeroSection>
        <ContentBackground>
          <PresentationSection />
          <PillarsSection />
          <VideoSection />
          <GallerySection />
          <TeamSection />
        </ContentBackground>
        <Footer />
      </main>
    </WalkingListProvider>
  )
}
