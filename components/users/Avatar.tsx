import React from "react";
import styles from "./Avatar.module.css";
import Image from "next/image";

type Props = {
  name: string;
  otherStyles?: string;
};

const Avatar = ({ name, otherStyles }: Props) => (
  <>
    <div
      className={`${styles.avatar} ${otherStyles} h-9 w-9`}
      data-tooltip={name}
    >
      <Image
        src={`https://liveblocks.io/avatars/avatar-${Math.floor(
          Math.random() * 30
        )}.png`}
        fill
        className={styles.avatar_picture}
        alt={name}
      />
    </div>
  </>
);

export default Avatar;
