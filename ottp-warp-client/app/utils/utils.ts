import axios from 'axios'
import { NEXT_PUBLIC_SCHEMAUID, NEXT_PUBLIC_URL } from '../config';
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { setVData } from './redis';
import { join } from 'path';
import satori from 'satori';
import { ReactNode } from 'react';
import sharp from 'sharp';
import * as fs from "fs"
import { bkgndImage1a } from '../../public/bkgndImage-1a';
import { OttpClient } from '@ottp/sdk'
import { AttestationDocument } from '@ottp/sdk/dist/interface';

const ottp = new OttpClient()

const getHtmlElement = async(fromFid: string, toFids: string, text: string) => {    
    try {
        const { html } = await import('satori-html')
        const htmlElement = html`<style>
        .confirmation-card {
              background: white;
              border-radius: 8px;
              /*box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);*/          
              margin-left: 10px; /* Maintain left margin */
              width: 600px; /* Specify width */
              height: 400px; /* Specify height */
              text-align: left;
              display: flex;
              flex-direction: column;
          }
          
          .protocol {
              color: #0000FF; /* Blue color for protocol, username, and mention */
              font-size: 24px; /* Matching protocol for consistency */
              font-weight: 500;
              margin-top: 10px; /*
              margin-bottom: 20px; /* Space after protocol text */
              top: 50px;
              left: 20px

          }
          
          .username, .mention {
              color: #0000FF; /* Blue color for protocol, username, and mention */
              font-size: 16px; /* Matching protocol for consistency */
              margin-left: 4px;
              margin-top: 1px; /* Space after username
              margin-bottom: 2em; /* Space after protocol text */
          }
      
          .attestation {
              font-size: 16px;
              line-height: 1.5;
              display: flex;
              flex-direction: column;
          }
          
          .submitted-line {
              display: flex; /* Use flex to keep inline nature */
              flex-wrap: wrap; /* Allow contents to wrap like inline elements */
              margin-top: 10px; /* Space after username
              margin-bottom: 0.75em; /* Space after each attestation line */
              color: #000; /* Default text color */
              top: 70px;
              left: 20px;
          }
    
          .collab-line {
              display: flex; /* Use flex to keep inline nature */
              flex-wrap: wrap; /* Allow contents to wrap like inline elements */
              margin-top: 1px; /* Space after username
              margin-bottom: 0.75em; /* Space after each attestation line */
              color: #000; /* Default text color */
              top: 71px;
              left: 20px;
          }
          
          .attestation-text {
              display: flex; /* Use flex to keep inline nature */
              flex-wrap: wrap; /* Allow contents to wrap like inline elements */
              margin-top: 1px; /* Space after username
              margin-bottom: 0.75em; /* Space after each attestation line */
              color: #000; /* Default text color */
              top: 72px;
              left: 20px;
          }
    
          .confirmation-notice {
              color: #000;
              font-size: 14px;
              margin-top: 1px; /* Space before the confirmation notice */
              top: 170px;
              left: 20px;
          }
          
          @media screen and (max-width: 768px) {
              .confirmation-card {
                  width: 80%; /* Adjust card size for smaller screens */
                  margin-left: 20px; /* Adjust margin for smaller screens */
                  padding: 10px;
              }
            }
      </style>
        
        <div class="confirmation-card">
          <div class="protocol">ottp://</div>
          <div class="attestation">
              <div class="submitted-line">
                  Submitted by: <div class="username">${fromFid}</div>
              </div>
              <div class="collab-line">
                  Collaborator(s): <div class="mention">${toFids}</div>
              </div>
              <div class="attestation-text">Attestation: ${text}</div>
          </div>
          <div class="confirmation-notice">By attesting, you are confirming onchain.</div>
      </div>`
        
        return htmlElement
    } catch (e) {
        console.error(e)
    }  
}

const toPng = async (fromFid: string, toFids: string, text: string) => {
    const fontPath = join(process.cwd(), 'IBMPlexMono-Regular.ttf')
    let fontData = fs.readFileSync(fontPath)
    const svg = await satori(
        await getHtmlElement(fromFid, toFids, text) as ReactNode,
        {
            width: 600, height: 400,
            fonts: [{
                data: fontData,
                name: 'IBMPlexMono',
                style: 'normal',
                weight: 400
            }]
        })
    
    // Convert SVG to PNG using Sharp
    const pngBuffer = await sharp(Buffer.from(svg))
        .resize(600,400, {
            fit: sharp.fit.fill,
        })
        .toFormat('png')
        .toBuffer();    
    const imageData = 'data:image/png;base64,'+ pngBuffer.toString('base64')
    //console.log(imageData)
    return imageData
}


const getFnameFromFid = async (fid: number): Promise<string> => { 
    if (!fid) 
        throw new Error ('Fid cannot be empty')
    try {
        //const response = await axios.get(`https://fnames.farcaster.xyz/transfers?fid=${fid}`)
        const response = await axios.get(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}&viewer_fid=316300`, {
            headers: {
                accept: 'application/json',
                api_key: process.env.NEYNAR_API_KEY,                
            }
        })
        //console.log(response.data)        
        //return response.data?.transfers[0].username
        return response.data?.users[0].username
    } catch (err) {
        throw(err)
    }
}

const getFidFromFname = async (fname: string): Promise<string> => { 
    if (!fname) 
        throw new Error ('Fname cannot be empty')
    try {
        //const response = await axios.get(`https://fnames.farcaster.xyz/transfers?name=${fname}`)
        const response = await axios.get(`https://api.neynar.com/v2/farcaster/user/search?q=${fname}&viewer_fid=316300`, {
            headers: {
                accept: 'application/json',
                api_key: process.env.NEYNAR_API_KEY,                
            }
        })
        //console.log(response.data)        
        //return response.data?.transfers[0].id
        return response.data?.result.users[0].fid
    } catch (err) {
        throw(err)
    }
}

const getTaggedData = (text: string): string[] => {
    const taggedDataPattern = /@\w+/g            
    const matches = text.match(taggedDataPattern)            
    if (!matches) {
        return [];
    }
    return matches.map(taggedData => taggedData.substring(1));
}

const getFids = async(text: string): Promise<string[]> => {
    if (!text)
        throw new Error ('Fnames cannot be empty')
    try {
        const fnames: string[] = getTaggedData(text)     
        let fidArray: string[] = []
        if (!fnames){
            return fidArray
        } else {
            for (let fname of fnames) {
                fidArray.push(await getFidFromFname(fname))
            }            
            return fidArray
        }
    } catch (err) {
        throw(err)
    }
}

const validateCollabUserInput = (text: string): boolean => {
    // Identify segments starting with '@' and possibly followed by any characters
    // except for spaces, punctuation, or special characters (excluding '@').
    const segments = text.match(/@\w+/g) || [];

    // Validate that the original text only contains the valid segments and separators.
    // Rebuild what the valid text should look like from the segments.
    const validText = segments.join(' '); // Using space as a generic separator for validation.

    // Further process the text to remove all valid segments, leaving only separators.
    // This step checks if there are any extra characters or segments that don't start with '@'.
    const remainingText = text.replace(/@\w+/g, '').trim();

    // Check if the remaining text contains only spaces, punctuation, or special characters (excluding '@').
    // This can be adjusted based on the specific separators you expect between words.
    const isValidSeparators = remainingText.length === 0 || /^[^@\w]+$/g.test(remainingText);

    // Ensure every identified segment starts with '@' and contains no additional '@'.
    const isValidSegments = segments.every(segment => segment.startsWith('@') && !segment.slice(1).includes('@'));

    // The text is valid if the separators are valid, and all segments start with '@' without additional '@'.
    return isValidSegments && isValidSeparators;
};

const publicClient = createPublicClient({
    chain: base,
    transport: http()
})

const getAttestandOttpId = async (txnId: string, fid: number): Promise<{attestUid: string; ottpId: number} | any > => {
    try {        
        const hash = txnId as `0x${string}`
        const transactionReceipt = await publicClient.waitForTransactionReceipt({ hash })
        
        //console.log(transactionReceipt)
        let attestUid = transactionReceipt.logs[0]?.data
        console.log(attestUid)

        if (transactionReceipt.logs[1]) {
            let oidHex = transactionReceipt.logs[1].topics[1] 
            console.log('OTTP Hex: ', oidHex)    
            return {attestUid, ottpId: parseInt(oidHex as string, 16)}
        }
        else {
            const ottpId = await ottp.getOttpId(fid)
            return {attestUid, ottpId: ottpId}
        }
    } catch (e) {
        console.error(e)
        //return e
        return new Error('Failed to retrieve attestUid or OttpId')
    }
}

const getFnames = async (toFids: string): Promise<string> => {
    const fidArray: string[] = toFids.split(',')    
    const fnamePromises: Promise<string>[] = fidArray.map(fid => getFnameFromFid(Number(fid)));
    const fnameArray: string[] = await Promise.all(fnamePromises);
    const prefixedFnames: string = fnameArray.map(name => '@' + name).join(' ')
    return prefixedFnames
}

const removeDupFname = (fromFname: string, toFnames: string): string => {    
    const fnames = toFnames.split(' ')    
    const updatedToFnames = fnames.filter(word => word !== fromFname)
    return updatedToFnames.join(' ');
}

const cast = async (fromFid: number, attestData: string) => {
    //console.log('From FID: ',fromFid)
    //console.log('Attest Data: ',attestData)
    const fromFname = await getFnameFromFid(fromFid)
    const toFnames = await getFnames(JSON.parse(attestData).toFids)
    //console.log('To Fnames: ', toFnames)    
    const vid = `v${Date.now()}`
    setVData(fromFname, toFnames, vid, attestData)
    const updatedToFnames: string = removeDupFname(fromFname, toFnames)
        
    const text: string = updatedToFnames === "" 
        ? `@${fromFname} Your attestation is onchain. Verify the attestation.\n\n (Skip if you submitted.)`
        : `@${fromFname} ${updatedToFnames} Your collaboration is onchain. Verify the attestation.\n\n (Skip if you submitted.)`
    
    //console.log(text)
    const options = {
        method: 'POST',
        url: 'https://api.neynar.com/v2/farcaster/cast',
        headers: {
          accept: 'application/json',
          api_key: process.env.NEYNAR_API_KEY,
          'content-type': 'application/json'
        },
        data: {
          signer_uuid: process.env.SIGNER_UUID,
          text: text,
          embeds: [{url: `${NEXT_PUBLIC_URL}/api?v=${vid}`}]
        }
    };
      
    axios
        .request(options)
        .then(function (response) {
          console.log(response.data);
        })
        .catch(function (error) {
          console.error(error);
        });
}

const getOttpIdHtmlElement = async(fname: string, ottpId: string, attestations: string, collaborators: string) => {    
    try {
        const { html } = await import('satori-html')
        const htmlElement = html`<style>
        .background-image {
            position: relative;
            width: 600px; /* Adjust to the width of your image */
            height: 314px; /* Adjust to the height of your image */
            background-image: url(${bkgndImage1a});
            background-size: cover;
            background-position: center;
            display: flex;
        }
        
        .textContent {
            position: absolute;
            color: white; /* Change text color as needed */    
            font-size: 24px; /* Adjust font size as needed */
            padding: 0 1px; 
            box-sizing: border-box;
            display: flex;
        }
        
        .top-left,
        .top-right,
        .bottom-left,
        .bottom-right {
            width: 50%;
            height: 50%;
        }
        
        .textq1 {    
            font-size: 22px;
            color: black;
            top: 55px;
            left: 30px;
        }
        
        
        .textq2 {    
            font-size: 60px;
            color: white;
            top: 0px;
            left: 325px;
        }
        
        .textq3 {    
            font-size: 60px;
            color: white;
            top: 150px;
            left: 30px;
        }
        
        .textq4 {    
            font-size: 60px;
            color: white;
            top: 150px;
            left: 325px;
        }
        
        /* Centering the text vertically and horizontally */
        .textContent p {
            position: absolute;    
        }
        </style>
        
        
        
        <div class="background-image">
            <div class="textContent textq1">
                <p>@${fname}</p>
            </div>
            <div class="textContent textq2">
                <p>${collaborators}</p>
            </div>
            <div class="textContent textq3">
                <p>${ottpId}</p>
            </div>
            <div class="textContent textq4">
                <p>${attestations}</p>
            </div>
        </div>`
        
        return htmlElement
    } catch (e) {
        console.error(e)
    }  
}

const toOttpIdPng = async (ottpId: string, fromFid: string) => {
    
    const fontPath = join(process.cwd(), 'IBMPlexMono-Regular.ttf')
    let fontData = fs.readFileSync(fontPath)
    const attestations: AttestationDocument[] | null = await ottp.getOttpAttestations(fromFid)
    const collaborators = await ottp.getCollaborators(fromFid)
    
    const fname = await getFnameFromFid(parseInt(fromFid))
    const svg = await satori(
        await getOttpIdHtmlElement(fname, ottpId, attestations?.length.toString()!, collaborators?.length.toString()!) as ReactNode,
        {
            width: 600, height: 314,
            fonts: [{
                data: fontData,
                name: 'IBMPlexMono',
                style: 'normal',
                weight: 400
            }]
        })
    
    // Convert SVG to PNG using Sharp
    const pngBuffer = await sharp(Buffer.from(svg))
        .resize(600,314, {
            fit: sharp.fit.fill,
        })
        .toFormat('png')
        .toBuffer();    
    const imageData = 'data:image/png;base64,'+ pngBuffer.toString('base64')
    //console.log(imageData)
    return imageData
}

export {getFids, validateCollabUserInput, getTaggedData, getAttestandOttpId, cast, toPng, toOttpIdPng}
