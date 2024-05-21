import { getFrameMetadata } from '@coinbase/onchainkit/frame';
import type { Metadata } from 'next';
import { NEXT_PUBLIC_OTTP_URL, NEXT_PUBLIC_URL } from './config';
import { permanentRedirect } from 'next/navigation'

const frameMetadata = getFrameMetadata({
  buttons: [
    {
      "label": "Next",
      "action": "post",                
    },
  ],        
  image: {
    src: `${NEXT_PUBLIC_URL}/ottp-frame-3a-1.png`,
    //aspectRatio: '1:1',
  },
  input: {text: 'Tag collaborators e.g. @df @v'},          
  postUrl: `${NEXT_PUBLIC_URL}/api/next`,      
})

export const metadata: Metadata = {
  title: 'Open to the Public',
  description: 'The open collaboration protocol',
  openGraph: {
    title: 'Open to the Public',
    description: 'The open collaboration protocol',
    images: [`${NEXT_PUBLIC_URL}/ottp-frame-3a-1.png`],
  },
  other: {
    ...frameMetadata,
  },
}

export default function Page() {
  //permanentRedirect(`${NEXT_PUBLIC_OTTP_URL}`)
  return (
    <>
      <a href="https://opentothepublic.org/"><h1>Open to the Public</h1></a>
    </>
  );
}
