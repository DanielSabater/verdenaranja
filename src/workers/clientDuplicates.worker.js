import { findDuplicateSuggestions } from '../utils/clientDeduplication.js'
self.onmessage = ({ data }) => {
  const suggestions = findDuplicateSuggestions(data.clients, new Set(data.ignored))
  self.postMessage(suggestions.map(({ clientA, clientB, ...suggestion }) => ({ ...suggestion, clientAId: clientA.id, clientBId: clientB.id })))
}
