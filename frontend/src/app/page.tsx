import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.backgroundContainer}>
        <Image 
          src="/background.png" 
          alt="Background" 
          fill 
          className={styles.backgroundImage}
          priority
          sizes="100vw"
        />
      </div>
      
      <div className={styles.contentContainer}>
        <div className={styles.synthLogoWrapper}>
          <Image 
            src="/synth_logo.png" 
            alt=".synth" 
            width={1000}
            height={300}
            className={styles.synthLogo}
            priority
          />
        </div>
      </div>
    </main>
  );
} 