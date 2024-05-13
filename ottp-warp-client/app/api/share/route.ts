import { FrameRequest, getFrameHtmlResponse } from '@coinbase/onchainkit/frame';
import { NextRequest, NextResponse } from 'next/server';
import { NEXT_PUBLIC_URL } from '../../config';
import { getFids, toOttpIdPng, validateCollabUserInput } from '../../utils/utils'
import { createCacheObj, delCache, getData, inCache, setData } from '../../utils/redis';

const getResponse = async (req: NextRequest): Promise<NextResponse> => {
  const ottpId = req.nextUrl.searchParams.get('ottpid')
  const fromFid = req.nextUrl.searchParams.get('fromFid')
  
  const ottpImageUrl = await toOttpIdPng(ottpId!, fromFid!)
  const response = new NextResponse(
    getFrameHtmlResponse({
      buttons: [
        {
          "label": "Get your work verified onchain",
          "action": 'post',                
        },        
      ],
      image: ottpImageUrl,
      postUrl: `${NEXT_PUBLIC_URL}/api/restart`,
      ogTitle: 'Open to the Public',
      ogDescription: 'The open collaboration protocol'   
    })
  )
  response.headers.set("Cache-Control", "public, max-age=0")

  return response
}

export const GET = async(req: NextRequest): Promise<Response> => {
  return getResponse(req);
}

export const dynamic = 'force-dynamic';
