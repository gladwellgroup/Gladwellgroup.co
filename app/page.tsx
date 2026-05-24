import { Navbar } from "@/components/layout/navbar"
import { HeroSection } from "@/components/sections/hero-section"
import { VideoSection } from "@/components/sections/video-section"
import { PillarsSection } from "@/components/sections/pillars-section"
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
        <HeroSection />
        <ContentBackground>
          <VideoSection />
          <PillarsSection />
          <GallerySection />
          <TeamSection />
        </ContentBackground>
        <Footer />
      </main>
    </WalkingListProvider>
  )
}
