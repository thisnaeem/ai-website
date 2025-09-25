'use client';

import { useState, useEffect } from 'react';
import { userSettingsAPI, facebookPagesAPI, testAPI } from '@/lib/api';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  
  // Facebook Pages state
  const [facebookPages, setFacebookPages] = useState<Array<{id: string, name: string, accessToken: string, picture?: string, followersCount?: number}>>([]);
  const [newPageId, setNewPageId] = useState('');
  const [newPageToken, setNewPageToken] = useState('');
  const [isAddingPage, setIsAddingPage] = useState(false);
  

  
  // Cloudinary state
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryApiKey, setCloudinaryApiKey] = useState('');
  const [cloudinaryApiSecret, setCloudinaryApiSecret] = useState('');
  const [cloudinaryMessage, setCloudinaryMessage] = useState('');
  const [cloudinaryMessageType, setCloudinaryMessageType] = useState<'success' | 'error'>('success');
  const [isTestingCloudinary, setIsTestingCloudinary] = useState(false);

  useEffect(() => {
    // Load settings from database
    const loadSettings = async () => {
      try {
        // Load user settings
        const settings = await userSettingsAPI.getSettings();
        if (settings.geminiApiKey) {
          setApiKey(settings.geminiApiKey);
        }
        if (settings.cloudinaryCloudName) {
          setCloudinaryCloudName(settings.cloudinaryCloudName);
        }
        if (settings.cloudinaryApiKey) {
          setCloudinaryApiKey(settings.cloudinaryApiKey);
        }
        if (settings.cloudinaryApiSecret) {
          setCloudinaryApiSecret(settings.cloudinaryApiSecret);
        }

        // Load Facebook pages
        const pages = await facebookPagesAPI.getUserPages();
        setFacebookPages(pages);
      } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback to localStorage for backward compatibility
        const savedApiKey = localStorage.getItem('gemini_api_key');
        if (savedApiKey) {
          setApiKey(savedApiKey);
        }

        const savedPages = localStorage.getItem('facebook_pages');
        if (savedPages) {
          try {
            setFacebookPages(JSON.parse(savedPages));
          } catch (error) {
            console.error('Error parsing saved Facebook pages:', error);
          }
        }

        const savedCloudName = localStorage.getItem('cloudinary_cloud_name');
        const savedApiKeyLocal = localStorage.getItem('cloudinary_api_key');
        const savedApiSecret = localStorage.getItem('cloudinary_api_secret');
        
        if (savedCloudName) setCloudinaryCloudName(savedCloudName);
        if (savedApiKeyLocal) setCloudinaryApiKey(savedApiKeyLocal);
        if (savedApiSecret) setCloudinaryApiSecret(savedApiSecret);
      }
    };

    loadSettings();
  }, []);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setMessage('Please enter an API key.');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    try {
      await userSettingsAPI.updateApiKey(apiKey.trim());
      setMessage('API key saved successfully!');
      setMessageType('success');
    } catch (error) {
      console.error('Error saving API key:', error);
      setMessage(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearApiKey = async () => {
    setIsLoading(true);
    try {
      await userSettingsAPI.updateApiKey('');
      setApiKey('');
      setMessage('API key cleared successfully!');
      setMessageType('success');
    } catch (error) {
      console.error('Error clearing API key:', error);
      setMessage(`Failed to clear API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const testApiKey = async () => {
    if (!apiKey.trim()) {
      setMessage('Please enter an API key first.');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await testAPI.testGeminiKey(apiKey.trim());
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test API key');
      }
      
      setMessage('API key is valid and working!');
      setMessageType('success');
    } catch (error) {
      setMessage(`API key test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const addFacebookPage = async () => {
    if (!newPageId.trim() || !newPageToken.trim()) {
      setMessage('Please fill in all fields.');
      setMessageType('error');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Fetch page details from Facebook Graph API
      const response = await fetch(`https://graph.facebook.com/v18.0/${newPageId}?fields=id,name,picture,followers_count&access_token=${newPageToken}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch page details. Please check your Page ID and Access Token.');
      }

      const pageData = await response.json();
      
      const newPage = {
        id: pageData.id,
        name: pageData.name,
        accessToken: newPageToken.trim(),
        picture: pageData.picture?.data?.url,
        followersCount: pageData.followers_count
      };

      // Update local state
      const updatedPages = [...facebookPages, newPage];
      setFacebookPages(updatedPages);
      
      // Sync to database
      await facebookPagesAPI.syncUserPages(updatedPages);

      setMessage('Facebook page added successfully!');
      setMessageType('success');
      setIsAddingPage(false);
      setNewPageId('');
      setNewPageToken('');
    } catch (error) {
      setMessage(`Failed to add page: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const removeFacebookPage = async (pageId: string) => {
    try {
      // Remove from database
      await facebookPagesAPI.removeUserPage(pageId);
      
      // Update local state
      const updatedPages = facebookPages.filter(page => page.id !== pageId);
      setFacebookPages(updatedPages);
      
      setMessage('Facebook page removed successfully!');
      setMessageType('success');
    } catch (error) {
      console.error('Failed to remove page:', error);
      setMessage(`Failed to remove page: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    }
  };





    const saveCloudinaryConfig = async () => {
     if (!cloudinaryCloudName.trim() || !cloudinaryApiKey.trim() || !cloudinaryApiSecret.trim()) {
       setCloudinaryMessage('Please fill in all Cloudinary fields.');
       setCloudinaryMessageType('error');
       return;
     }

     setIsTestingCloudinary(true);
     try {
       await userSettingsAPI.updateCloudinaryConfig({
         cloudinaryCloudName: cloudinaryCloudName.trim(),
         cloudinaryApiKey: cloudinaryApiKey.trim(),
         cloudinaryApiSecret: cloudinaryApiSecret.trim()
       });
       
       setCloudinaryMessage('Cloudinary configuration saved successfully!');
       setCloudinaryMessageType('success');
     } catch (error) {
       console.error('Error saving Cloudinary config:', error);
       setCloudinaryMessage(`Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
       setCloudinaryMessageType('error');
     } finally {
       setIsTestingCloudinary(false);
     }
   };

   const testCloudinaryConnection = async () => {
     if (!cloudinaryCloudName.trim() || !cloudinaryApiKey.trim() || !cloudinaryApiSecret.trim()) {
       setCloudinaryMessage('Please save your Cloudinary configuration first.');
       setCloudinaryMessageType('error');
       return;
     }

     setIsTestingCloudinary(true);
     setCloudinaryMessage('');
     
     try {
       const response = await testAPI.testCloudinary({
         cloudinaryCloudName: cloudinaryCloudName.trim(),
         cloudinaryApiKey: cloudinaryApiKey.trim(),
         cloudinaryApiSecret: cloudinaryApiSecret.trim()
       });
       
       if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.error || 'Failed to test Cloudinary connection');
       }
       
       setCloudinaryMessage('Cloudinary connection test successful!');
       setCloudinaryMessageType('success');
     } catch (error) {
       setCloudinaryMessage(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
       setCloudinaryMessageType('error');
     } finally {
       setIsTestingCloudinary(false);
     }
   };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure your Gemini API settings
        </p>
      </div>

        <div className="card">
          <div className="px-6 py-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Gemini API Configuration
            </h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700">
                  Gemini API Key
                </label>
                <div className="mt-1">
                  <input
                    type="password"
                    id="apiKey"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Get your API key from{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>

              {message && (
                <div className={`rounded-md p-4 ${
                  messageType === 'success' 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {messageType === 'success' ? (
                        <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm font-medium ${
                        messageType === 'success' ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleSaveApiKey}
                  disabled={isLoading}
                  className="inline-flex justify-center py-3 px-6 border border-transparent text-sm font-semibold rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Saving...' : 'Save API Key'}
                </button>
                
                <button
                  onClick={testApiKey}
                  disabled={isLoading || !apiKey.trim()}
                  className="inline-flex justify-center py-3 px-6 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Testing...' : 'Test API Key'}
                </button>
                
                <button
                  onClick={handleClearApiKey}
                  disabled={isLoading}
                  className="inline-flex justify-center py-3 px-6 border border-red-300 text-sm font-semibold rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Cloudinary Configuration */}
        <div className="card">
          <div className="px-6 py-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Cloudinary Configuration
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Configure Cloudinary for automatic media uploads and management.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cloud Name *
                </label>
                <input
                  type="text"
                  value={cloudinaryCloudName}
                  onChange={(e) => setCloudinaryCloudName(e.target.value)}
                  placeholder="Enter your Cloudinary cloud name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key *
                </label>
                <input
                  type="text"
                  value={cloudinaryApiKey}
                  onChange={(e) => setCloudinaryApiKey(e.target.value)}
                  placeholder="Enter your Cloudinary API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Secret *
                </label>
                <input
                  type="password"
                  value={cloudinaryApiSecret}
                  onChange={(e) => setCloudinaryApiSecret(e.target.value)}
                  placeholder="Enter your Cloudinary API secret"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={saveCloudinaryConfig}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg btn-primary"
                >
                  Save Configuration
                </button>
                <button
                  onClick={testCloudinaryConnection}
                  disabled={isTestingCloudinary}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isTestingCloudinary ? 'Testing...' : 'Test Connection'}
                </button>
              </div>
              
              {cloudinaryMessage && (
                <div className={`p-3 rounded-md text-sm ${
                  cloudinaryMessageType === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {cloudinaryMessage}
                </div>
              )}
            </div>
            

          </div>
        </div>

        {/* Facebook Pages Management */}
        <div className="card">
          <div className="px-6 py-8">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Facebook Pages
            </h3>
            
            {/* Existing Pages */}
            {facebookPages.length > 0 && (
              <div className="mb-6">
                
                <div className="space-y-3">
                   {facebookPages.map((page) => (
                     <div key={page.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                       <div className="flex items-center space-x-3">
                         {page.picture && (
                           <img
                             src={page.picture}
                             alt={`${page.name} profile`}
                             className="w-10 h-10 rounded-full object-cover"
                           />
                         )}
                         <div>
                           <div className="font-medium text-gray-900">{page.name}</div>
                           <div className="text-sm text-gray-500">
                             ID: {page.id}
                             {page.followersCount !== undefined && (
                               <span className="ml-2">• {page.followersCount.toLocaleString()} followers</span>
                             )}
                           </div>
                         </div>
                       </div>
                       <button
                         onClick={() => removeFacebookPage(page.id)}
                         className="text-red-600 hover:text-red-800 text-sm font-medium"
                       >
                         Remove
                       </button>
                     </div>
                   ))}
                 </div>
              </div>
            )}
            
            {/* Add New Page */}
            {!isAddingPage ? (
              <button
                onClick={() => setIsAddingPage(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg btn-primary"
              >
                Add Facebook Page
              </button>
            ) : (
              <div className="space-y-4 p-4 border border-gray-200 rounded-md">
                 <h4 className="text-sm font-medium text-gray-700">Add New Facebook Page</h4>
                 <p className="text-sm text-gray-600">Enter your Page ID and Access Token. We&apos;ll automatically fetch the page name.</p>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Page ID *
                   </label>
                   <input
                     type="text"
                     value={newPageId}
                     onChange={(e) => setNewPageId(e.target.value)}
                     placeholder="Enter Facebook page ID"
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                   />
                 </div>
                 
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Page Access Token *
                   </label>
                   <input
                     type="password"
                     value={newPageToken}
                     onChange={(e) => setNewPageToken(e.target.value)}
                     placeholder="Enter page access token"
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary-highlight)] focus:border-[var(--primary-highlight)]"
                   />
                 </div>
                 
                 <div className="flex gap-3">
                   <button
                     onClick={addFacebookPage}
                     disabled={isLoading}
                     className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     {isLoading ? 'Adding Page...' : 'Add Page'}
                   </button>
                   <button
                     onClick={() => {
                       setIsAddingPage(false);
                       setNewPageId('');
                       setNewPageToken('');
                     }}
                     disabled={isLoading}
                     className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Cancel
                   </button>
                 </div>
               </div>
            )}
            
          </div>
        </div>


    </div>
  );
}