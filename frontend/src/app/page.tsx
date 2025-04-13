import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      {/* Simple div with background image */}
      <div className={styles.backgroundContainer}></div>
      
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