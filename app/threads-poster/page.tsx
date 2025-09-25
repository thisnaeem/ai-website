'use client';

export default function ThreadsPoster() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.5 12.01c0-3.576.85-6.43 2.495-8.481C5.845 1.225 8.598.044 12.179.02h.014c3.581.024 6.334 1.205 8.184 3.509C22.02 5.58 22.87 8.434 22.87 12.01c0 3.576-.85 6.43-2.495 8.481C18.721 22.775 15.968 23.956 12.387 23.98h-.201zm-.014-2.718c2.757-.02 4.851-.943 6.221-2.745 1.316-1.732 1.983-4.213 1.983-7.377 0-3.164-.667-5.645-1.983-7.377C16.823 2.161 14.729 1.238 11.972 1.218c-2.757.02-4.851.943-6.221 2.745C4.435 5.695 3.768 8.176 3.768 11.34c0 3.164.667 5.645 1.983 7.377 1.37 1.802 3.464 2.725 6.221 2.745h.2z"/>
              <path d="M17.212 10.798c-.045-2.264-1.583-4.084-3.732-4.42-.586-.092-1.2-.138-1.826-.138-2.757 0-5.654 1.138-5.654 4.56 0 3.422 2.897 4.56 5.654 4.56.626 0 1.24-.046 1.826-.138 2.149-.336 3.687-2.156 3.732-4.42v-.004z"/>
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Threads Poster</h1>
          <p className="text-xl text-gray-600 mb-8">Coming Soon</p>
          <div className="text-gray-500">
            <p>We&apos;re working hard to bring you an amazing Threads posting experience.</p>
            <p className="mt-2">Stay tuned for updates!</p>
          </div>
        </div>
        
        <div className="flex justify-center">
          <div className="animate-pulse flex space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}