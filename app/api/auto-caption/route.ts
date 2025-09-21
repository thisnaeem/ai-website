import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey, mediaUrl, mediaType, isComment = false } = await request.json();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }
    
    if (!mediaUrl) {
      return NextResponse.json(
        { error: 'Media URL is required' },
        { status: 400 }
      );
    }
    
    if (!mediaType || !['image', 'video'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'Valid media type (image or video) is required' },
        { status: 400 }
      );
    }
    
    // Create prompt based on media type and whether it's for comment
    const prompt = createAutoCaptionPrompt(mediaType, isComment);
    
    // For images, we can analyze directly with Gemini Vision
    if (mediaType === 'image') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [
                {
                  text: prompt
                },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: await getBase64FromUrl(mediaUrl)
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.7,
              topK: 1,
              topP: 1,
              maxOutputTokens: 100,
            }
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        return NextResponse.json(
          { error: 'Failed to analyze image' },
          { status: 500 }
        );
      }
      
      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        return NextResponse.json(
          { error: 'No caption generated' },
          { status: 500 }
        );
      }
      
      const generatedText = data.candidates[0].content.parts[0].text;
      const caption = generatedText.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
      
      return NextResponse.json({ caption });
    }
    
    // For videos, generate a generic video caption since Gemini can't analyze video content directly
    if (mediaType === 'video') {
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
              temperature: 0.8,
              topK: 1,
              topP: 1,
              maxOutputTokens: 100,
            }
          })
        }
      );
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error('Gemini API error:', errorData);
        return NextResponse.json(
          { error: 'Failed to generate video caption' },
          { status: 500 }
        );
      }
      
      const data = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        return NextResponse.json(
          { error: 'No caption generated' },
          { status: 500 }
        );
      }
      
      const generatedText = data.candidates[0].content.parts[0].text;
      const caption = generatedText.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
      
      return NextResponse.json({ caption });
    }
    
  } catch (error) {
    console.error('Error generating auto caption:', error);
    return NextResponse.json(
      { error: 'Failed to generate caption' },
      { status: 500 }
    );
  }
}

function createAutoCaptionPrompt(mediaType: string, isComment: boolean = false): string {
  if (isComment) {
    if (mediaType === 'image') {
      return `Analyze this image and create a single engaging comment for Facebook posting.

Requirements:
- Keep it under 10 words
- Make it conversational and friendly
- Include relevant emojis
- Be supportive or appreciative
- Focus on what makes the image appealing or interesting
- Sound like a genuine friend's comment

Return only the comment text, nothing else.`;
    }
    
    if (mediaType === 'video') {
      return `Generate a single engaging comment for a video post on Facebook.

Requirements:
- Keep it under 10 words
- Make it conversational and friendly
- Include relevant emojis
- Use encouraging or excited language
- Create engagement and positivity
- Sound like a genuine friend's comment
- Be generic enough to work for most video content

Return only the comment text, nothing else.`;
    }
    
    return 'Generate an engaging social media comment.';
  }
  
  if (mediaType === 'image') {
    return `Analyze this image and create a single engaging one-liner caption for Facebook posting. 

Requirements:
- Keep it under 15 words
- Make it engaging and social media friendly
- Include relevant emojis
- Be descriptive but concise
- Focus on what makes the image interesting or appealing

Return only the caption text, nothing else.`;
  }
  
  if (mediaType === 'video') {
    return `Generate a single engaging one-liner caption for a video post on Facebook.

Requirements:
- Keep it under 15 words
- Make it engaging and social media friendly
- Include relevant emojis
- Use action words that suggest movement or excitement
- Create curiosity to make people want to watch
- Be generic enough to work for most video content

Return only the caption text, nothing else.`;
  }
  
  return 'Generate an engaging social media caption.';
}

async function getBase64FromUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to process image');
  }
}