const fs = require('fs');

const files = ['/app/applet/src/pages/Dashboard.tsx', '/app/applet/src/pages/Admin.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');

  // Colors
  content = content.replace(/gray-50/g, 'stone-50');
  content = content.replace(/gray-100/g, 'stone-100');
  content = content.replace(/gray-200/g, 'stone-200');
  content = content.replace(/gray-300/g, 'stone-300');
  content = content.replace(/gray-400/g, 'stone-400');
  content = content.replace(/gray-500/g, 'stone-500');
  content = content.replace(/gray-600/g, 'stone-600');
  content = content.replace(/gray-700/g, 'stone-700');
  content = content.replace(/gray-800/g, 'stone-800');
  content = content.replace(/gray-900/g, 'stone-900');

  content = content.replace(/blue-50/g, 'indigo-50/80');
  content = content.replace(/blue-100/g, 'indigo-100');
  content = content.replace(/blue-200/g, 'indigo-200');
  content = content.replace(/blue-300/g, 'indigo-300');
  content = content.replace(/blue-400/g, 'indigo-400');
  content = content.replace(/blue-500/g, 'indigo-500');
  content = content.replace(/blue-600/g, '#4F46E5');
  content = content.replace(/blue-700/g, 'indigo-700');
  content = content.replace(/blue-800/g, 'indigo-800');
  content = content.replace(/blue-900/g, 'indigo-900');

  // Emerald updates
  content = content.replace(/emerald-100/g, 'orange-50');
  content = content.replace(/emerald-500/g, 'orange-400');
  content = content.replace(/emerald-600/g, 'orange-500');
  content = content.replace(/emerald-700/g, 'orange-600');

  // Specific HEX
  // border-stone-200 to #E7E5E4
  content = content.replace(/border-stone-200/g, 'border-[#E7E5E4]');
  // rounded
  content = content.replace(/rounded-xl/g, 'rounded-[20px]');
  content = content.replace(/rounded-lg/g, 'rounded-[16px]');

  // Specific overrides for 'submit' buttons where we want the Orange Accent #FB923C
  // Like "確認預約" or "✅ 確定取消"
  content = content.replace(/bg-\[\#4F46E5\] text-white(.*?)>(\s*)確認預約/g, 'bg-[#FB923C] text-white$1 hover:bg-orange-500>$2確認預約');
  
  // Actually, I can use JS regex for easier stuff
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + file);
});
