import Image from "next/image";
import styles from "./page.module.css";
import dynamic from "next/dynamic";

// Используем dynamic import для компонента с Three.js,
// так как он требует доступа к window и не может быть рендерен на сервере
const SpaceScene = dynamic(() => import("./page-components/SpaceScene"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading space scene...</div>
});

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Simple div with background image */}
      <div className={styles.backgroundContainer}></div>
      
      {/* Space scene with cosmic objects */}
      <div className={styles.spaceSceneContainer}>
        <SpaceScene />
      </div>
      
      {/* Content positioned according to design */}
      <div className={styles.contentContainer}>
        <div className={styles.logoContainer}>
          <Image 
            src="/images/synth_logo.png" 
            alt=".synth" 
            width={500}
            height={146}
            priority
          />
        </div>
      </div>
    </main>
  );
} 