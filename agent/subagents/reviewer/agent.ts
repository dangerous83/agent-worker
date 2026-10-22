import { defineAgent } from 'eve';
export default defineAgent({ defaultTools:false,description:"Review content for brand fit and unsupported claims.",model:'openai/gpt-6-luna-fast'});
