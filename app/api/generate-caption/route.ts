import { NextRequest, NextResponse } from 'next/server';

type Platform = 'facebook' | 'threads';
type Topic = 'Jobs' | 'Princess leonar' | 'USA girl' | 'sheikha mahira';
type PostType = 'profile post' | 'group post' | 'page post';

interface GenerateRequest {
  apiKey: string;
  platform: Platform;
  topic: Topic;
  postType: PostType;
  captionCount: number;
  generateComments?: boolean;
  includeLink?: boolean;
  linkUrl?: string;
  specificCaption?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      apiKey, 
      platform, 
      topic, 
      postType, 
      captionCount, 
      generateComments = false,
      includeLink = false,
      linkUrl,
      specificCaption
    }: GenerateRequest = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Create the prompt for Gemini
    const prompt = createPrompt(platform, topic, postType, captionCount, generateComments, includeLink, linkUrl, specificCaption);
    
    // Generate captions using Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 1,
            topP: 1,
            maxOutputTokens: 2048,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to generate captions' },
        { status: 500 }
      );
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json(
        { error: 'No captions generated' },
        { status: 500 }
      );
    }

    const generatedText = data.candidates[0].content.parts[0].text;
    
    // Parse the response to extract captions and comment
    const parsedContent = parseGeneratedContent(generatedText, postType, !!specificCaption);
    
    return NextResponse.json(parsedContent);
  } catch (error) {
    console.error('Error generating captions:', error);
    return NextResponse.json(
      { error: 'Failed to generate captions' },
      { status: 500 }
    );
  }
}

function createPrompt(
  platform: Platform, 
  topic: Topic, 
  postType: PostType, 
  captionCount: number, 
  generateComments: boolean = false,
  includeLink: boolean = false,
  linkUrl?: string,
  specificCaption?: string
): string {
  const platformStyle = platform === 'facebook' 
    ? 'Facebook (more formal, with emojis and hashtags)' 
    : 'Threads (casual, conversational, trendy)';
  
  // If generating comment for specific caption
  if (specificCaption && generateComments) {
    return `Generate 1 engaging comment for this ${platform} caption:

"${specificCaption}"

Platform: ${platform}
Topic: ${topic}
Post type: ${postType}

Requirements:
1. Generate exactly 1 relevant comment
2. Comment should be engaging and encourage interaction
3. Match the ${platform} platform style and tone
4. Be supportive and add value to the conversation
${includeLink && linkUrl ? `5. Include this link naturally in the comment: ${linkUrl}` : ''}

Format your response as:
COMMENT: [your comment here]`;
  }
  
  const linkInstruction = includeLink && linkUrl 
    ? `\n- Include this link naturally in each caption: ${linkUrl}` 
    : '';
  
  const commentInstruction = generateComments 
    ? `\n- Generate 1 relevant comment for each caption that could be posted on this content` 
    : '';
  
  // Special handling for Princess Leonor topic
  if (topic === 'Princess leonar') {
    const leonorTemplate = `Generate ${captionCount} captions about Princess Leonor of Spain in this EXACT format:

👑 Princess Leonor stuns Spain with her royal elegance…
Her latest appearance has everyone talking 💃✨
📸 Leonor's Stunning Look 👇
👉 Link: ${includeLink && linkUrl ? linkUrl : 'https://cutt.ly/2rHurZRL'}
🎁 Full story in 1st Comment 👇

Requirements:
- Use emojis (👑, 💃, ✨, 📸, 👇, 👉, 🎁)
- Keep the same structure: hook line, description, photo line, link line, comment line
- Vary the content but maintain the format
- Topics: royal elegance, transformation, fashion, royal duties, style, ceremonies, talents
${generateComments ? '\n- Generate attractive comments like: "👑 Everyone is asking: Is Leonor the most beautiful princess in Europe? 💖\n👉 See the rare proof yourself: ' + (includeLink && linkUrl ? linkUrl : 'https://cutt.ly/2rHurZRL') + '"' : ''}

Format your response as follows:`;
    return leonorTemplate;
  }
  
  // Special handling for USA Girls topic
   if (topic === 'USA girl') {
     const usaGirlsTemplate = `Generate ${captionCount} captions about USA/European/Russian girls (ages 20-40) in this EXACT format:

💖 Hi, I'm 22 from USA 🇺🇸
I don't care if you're poor or rich, I just need a good boyfriend who truly loves me 💕
➡️ Apply Now: ${includeLink && linkUrl ? linkUrl : 'https://cutt.ly/OrHutuaR'}

Requirements:
- Use emojis (💖, 🇺🇸, 💕, ➡️, 💔, 👩‍🦱, 🌸, etc.)
- Ages 20-40 with variation
- Include: single, divorced, widow, single mom scenarios
- Countries: USA, Europe, Russia
- Emotional tone: direct, honest, vulnerable
- Call-to-action: Apply Now, Contact, Talk to Me, etc.
${generateComments ? '\n- Generate WhatsApp-style comments like: "💬 She\'s online now… Send her a quick Hi ❤️\n👉 ' + (includeLink && linkUrl ? linkUrl : 'https://cutt.ly/OrHutuaR') + '"' : ''}

Format your response as follows:`;
     return usaGirlsTemplate;
   }
   
   // Special handling for Sheikha Mahira topic
   if (topic === 'sheikha mahira') {
     const mahiraTemplate = `Generate ${captionCount} captions about Sheikha Mahira Dubai Queen lifestyle in this EXACT format:

👑 Dubai Queen Mahira Lifestyle Uncovered 👇
${includeLink && linkUrl ? linkUrl : 'https://cutt.ly/2rHurZRL'}
👆🎁 𝐂𝐡𝐞𝐜𝐤 𝐅𝐢𝐫𝐬𝐭 𝐂𝐨𝐦𝐦𝐞𝐧𝐭 📣👇
From private yachts 🛥️ to Burj Khalifa nights 🌃—Mahira is living every girl's dream 💖✨ #DubaiQueen #Mahira

Requirements:
- Use emojis (👑, 💎, ✨, 🌃, 🛥️, 🚘, 💖, 👇, 👆, 🎁, 📣)
- Structure: Title with 👇 → Link → Check First Comment line → Description with hashtags
- Topics: Dubai lifestyle, luxury cars, yachts, Burj Khalifa, gold markets, royal charm, glamour
- Bold styled text: 𝐂𝐡𝐞𝐜𝐤 𝐅𝐢𝐫𝐬𝐭 𝐂𝐨𝐦𝐦𝐞𝐧𝐭, 𝐅𝐮𝐥𝐥 𝐒𝐭𝐨𝐫𝐲, 𝐑𝐚𝐫𝐞 𝐒𝐭𝐨𝐫𝐲, 𝐒𝐞𝐞 𝐇𝐞𝐫 𝐉𝐨𝐮𝐫𝐧𝐞𝐲
- Hashtags: #DubaiQueen #Mahira #QueenMahira #DubaiLife #MahiraStyle #MahiraQueen
${generateComments ? '\n- Generate Dubai lifestyle comments like: "🌟 Mahira\'s Dubai secrets revealed! From gold shopping to royal parties 👑\n👉 Full story: ' + (includeLink && linkUrl ? linkUrl : 'https://cutt.ly/2rHurZRL') + '"' : ''}

Format your response as follows:`;
     return mahiraTemplate;
   }
   
   // Special handling for Jobs topic
   if (topic === 'Jobs') {
     const jobsTemplate = `Generate ${captionCount} captions about job opportunities abroad in this EXACT format:

🍎 Farm Workers Needed – Canada & New Zealand
🆓 Free Visa + 🏠 Accommodation Provided
🚜 Apple Picking | Dairy Farm | Vegetable Packing
⚡ Limited Seats – Apply Fast!
👉 Apply Now!

Requirements:
- Use emojis (🍎, 🆓, 🏠, 🚜, ⚡, 👉, 🏗️, 👷, 🍽️, 👨‍🍳, 🏭, 📦, 🚚, 💵)
- Structure: Job title with location → Free benefits → Job types → Urgency → Call to action
- Job categories: Farm Workers, Construction, Restaurant/Hotel, Factory/Warehouse, Driver jobs
- Benefits: Free Visa, Accommodation, Meals, Good Salary, Training
- Countries: Canada, New Zealand, Australia, Dubai, Qatar, UAE, UK, Europe
- Urgency phrases: Limited Seats, Apply Fast, Urgent Hiring, Don\'t Miss Out
${generateComments ? '\n- Generate job application comments like: "✅ Life-changing opportunity for jobs abroad!\n👉 Apply Here: ' + (includeLink && linkUrl ? linkUrl : 'https://cutt.ly/CrHsF9xC') + '"' : ''}

Format your response as follows:`;
     return jobsTemplate;
   }
  
  // Default format for other topics
  return `Generate ${captionCount} engaging ${platform} captions about "${topic}" for a ${postType}.

Platform style: ${platformStyle}
Topic: ${topic}
Post type: ${postType}

Requirements:
1. Generate exactly ${captionCount} unique captions
2. Each caption should be engaging and relevant to the topic
3. Match the ${platform} platform style and tone
4. Consider the post type (${postType}) when crafting content${linkInstruction}${commentInstruction}

Format your response as follows:
**CAPTIONS:**
1. [First caption]
${generateComments ? '**COMMENT 1:** [Comment for first caption]' : ''}

2. [Second caption]
${generateComments ? '**COMMENT 2:** [Comment for second caption]' : ''}

${captionCount > 2 ? `3. [Third caption]\n${generateComments ? '**COMMENT 3:** [Comment for third caption]' : ''}\n` : ''}
${captionCount > 3 ? `4. [Fourth caption]\n${generateComments ? '**COMMENT 4:** [Comment for fourth caption]' : ''}\n` : ''}
${captionCount > 4 ? `5. [Fifth caption]\n${generateComments ? '**COMMENT 5:** [Comment for fifth caption]' : ''}\n` : ''}

Make sure each caption is unique, engaging, and appropriate for the platform and topic.`;
}

function parseGeneratedContent(text: string, postType: PostType, isSpecificComment: boolean = false) {
  // Handle specific comment generation
  if (isSpecificComment) {
    const commentMatch = text.match(/COMMENT:\s*(.+)/i);
    if (commentMatch) {
      return { comments: [commentMatch[1].trim()] };
    }
    return { comments: [] };
  }
  
  const captions: string[] = [];
  const comments: string[] = [];
  
  // Split by double newlines to separate caption blocks
  const blocks = text.split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0 || !lines[0].trim()) continue;
    
    let captionLines: string[] = [];
    const commentLines: string[] = [];
    let isComment = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Skip headers
      if (trimmedLine.includes('**CAPTIONS:**') || trimmedLine.includes('CAPTIONS:')) {
        continue;
      }
      
      // Check for comment patterns
       if (trimmedLine.includes('👑 Everyone is asking') || 
           trimmedLine.includes('💬 She\'s online') || 
           trimmedLine.includes('📱 Want her WhatsApp') || 
           trimmedLine.includes('🌟 Mahira\'s Dubai secrets') ||
           trimmedLine.includes('✅ Life-changing opportunity') ||
           trimmedLine.match(/\*\*COMMENT\s*(\d+)?:\*\*/i)) {
        isComment = true;
        // Extract comment text
        const commentMatch = trimmedLine.match(/\*\*COMMENT\s*(\d+)?:\*\*\s*(.+)/i);
        if (commentMatch) {
          commentLines.push(commentMatch[2]);
        } else {
          commentLines.push(trimmedLine);
        }
        continue;
      }
      
      // Check for numbered captions (default format)
      const numberedMatch = trimmedLine.match(/^\d+\.\s*(.+)/);
      if (numberedMatch && !isComment) {
        if (captionLines.length > 0) {
          // Save previous caption
          captions.push(captionLines.join('\n').trim());
          captionLines = [];
        }
        captionLines.push(numberedMatch[1]);
        continue;
      }
      
      // Add to appropriate array
      if (isComment) {
        commentLines.push(trimmedLine);
      } else {
        captionLines.push(trimmedLine);
      }
    }
    
    // Add the caption and comment from this block
    if (captionLines.length > 0) {
      captions.push(captionLines.join('\n').trim());
    }
    if (commentLines.length > 0) {
      comments.push(commentLines.join('\n').trim());
    }
  }
  
  // If no captions found, try simple line-by-line parsing
  if (captions.length === 0) {
    const lines = text.split('\n');
    let currentCaption = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.includes('**CAPTIONS:**') || trimmedLine.includes('CAPTIONS:')) {
        continue;
      }
      
      // Skip comment lines
       if (trimmedLine.includes('👑 Everyone is asking') || 
           trimmedLine.includes('💬 She\'s online') || 
           trimmedLine.includes('📱 Want her WhatsApp') || 
           trimmedLine.includes('🌟 Mahira\'s Dubai secrets') ||
           trimmedLine.includes('✅ Life-changing opportunity') ||
           trimmedLine.match(/\*\*COMMENT\s*(\d+)?:\*\*/i)) {
        continue;
      }
      
      // Check for numbered captions
      const numberedMatch = trimmedLine.match(/^\d+\.\s*(.+)/);
      if (numberedMatch) {
        if (currentCaption) {
          captions.push(currentCaption.trim());
        }
        currentCaption = numberedMatch[1];
      } else if (currentCaption) {
        currentCaption += '\n' + trimmedLine;
      } else {
        currentCaption = trimmedLine;
      }
    }
    
    if (currentCaption) {
      captions.push(currentCaption.trim());
    }
  }
  
  // Generate default comments if none were found but captions exist
  if (captions.length > 0 && comments.length === 0) {
    for (let i = 0; i < captions.length; i++) {
      comments.push(`Great post! 👍 What do you think about this? 💭`);
    }
  }
  
  return {
    captions: captions.filter(caption => caption.length > 0),
    comments: comments.length > 0 ? comments : undefined
  };
}