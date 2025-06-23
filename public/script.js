// Enhanced AI Decision Maker with Modern UI
class DecisionMaker {
    constructor() {
        this.decisionHistory = JSON.parse(localStorage.getItem('decisionHistory')) || [];
        this.apiBaseUrl = window.location.origin + '/api'; // Dynamic API URL for Vercel
        this.loadHistory();
        this.updateStats();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Character counter for question textarea
        const questionTextarea = document.getElementById('decisionQuestion');
        const charCount = document.getElementById('charCount');
        
        questionTextarea.addEventListener('input', () => {
            const length = questionTextarea.value.length;
            charCount.textContent = `${length} / 500`;
            
            if (length > 450) {
                charCount.classList.add('text-red-500');
                charCount.classList.remove('text-gray-400');
            } else {
                charCount.classList.remove('text-red-500');
                charCount.classList.add('text-gray-400');
            }
            
            if (length >= 500) {
                questionTextarea.value = questionTextarea.value.substring(0, 500);
            }
        });

        // Auto-resize textareas
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = (textarea.scrollHeight) + 'px';
            });
        });

        // Add enter key support for main button
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.getDecision();
            }
        });
    }

    async getDecision() {
        const question = document.getElementById('decisionQuestion').value.trim();
        const category = document.getElementById('decisionCategory').value;
        const priority = document.getElementById('priorityLevel').value;
        const context = document.getElementById('additionalContext').value.trim();
        
        if (!question) {
            this.showToast('Please enter your decision question!', 'error');
            document.getElementById('decisionQuestion').focus();
            return;
        }

        if (question.length < 10) {
            this.showToast('Please provide more details about your decision.', 'warning');
            return;
        }

        const options = this.getOptions();
        const startTime = Date.now();
        
        this.showLoading();
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/analyze-decision`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question,
                    options,
                    category,
                    context: context + (priority !== 'medium' ? ` Priority Level: ${priority}` : ''),
                    priority
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const responseTime = ((Date.now() - startTime) / 1000).toFixed(1);
            
            if (result.success) {
                result.data.responseTime = responseTime;
                this.displayResults(result.data);
                this.saveToHistory(question, result.data, options, category);
                this.updateStats();
                this.showToast('Decision analysis complete!', 'success');
            } else {
                throw new Error(result.error || 'Unknown error occurred');
            }
            
        } catch (error) {
            console.error('Error getting decision:', error);
            this.showError('Sorry, there was an error processing your decision. Please check your connection and try again.');
            this.showToast('Failed to analyze decision. Please try again.', 'error');
        }
    }

    getOptions() {
        const optionInputs = document.querySelectorAll('#optionsContainer input');
        return Array.from(optionInputs)
            .map(input => input.value.trim())
            .filter(option => option.length > 0);
    }

    showLoading() {
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.classList.remove('hidden');
        resultsSection.innerHTML = `
            <div class="glass-white rounded-3xl p-12 text-center slide-up">
                <div class="relative mb-8">
                    <div class="animate-spin rounded-full h-20 w-20 border-4 border-indigo-200 border-t-indigo-600 mx-auto"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <i class="fas fa-brain text-indigo-600 text-2xl animate-pulse"></i>
                    </div>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 mb-4">🤖 Gemini AI is thinking...</h3>
                <p class="text-gray-600 mb-2">Analyzing your decision scenario</p>
                <p class="text-sm text-gray-500">Considering all factors and possibilities</p>
                
                <div class="mt-8 space-y-2">
                    <div class="flex items-center justify-center text-sm text-gray-500">
                        <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce mr-2"></div>
                        Processing decision factors...
                    </div>
                    <div class="flex items-center justify-center text-sm text-gray-500">
                        <div class="w-2 h-2 bg-purple-400 rounded-full animate-bounce mr-2" style="animation-delay: 0.1s"></div>
                        Evaluating options...
                    </div>
                    <div class="flex items-center justify-center text-sm text-gray-500">
                        <div class="w-2 h-2 bg-pink-400 rounded-full animate-bounce mr-2" style="animation-delay: 0.2s"></div>
                        Generating recommendations...
                    </div>
                </div>
            </div>
        `;
        
        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    showError(message) {
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.classList.remove('hidden');
        resultsSection.innerHTML = `
            <div class="glass-white rounded-3xl p-12 text-center slide-up">
                <div class="text-red-500 text-6xl mb-6">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 class="text-2xl font-bold text-red-600 mb-4">Oops! Something went wrong</h3>
                <p class="text-gray-600 mb-6 max-w-md mx-auto">${message}</p>
                <button onclick="decisionMaker.resetForm()" class="btn-primary text-white py-3 px-6 rounded-xl transition-all duration-300 hover:scale-105">
                    <i class="fas fa-redo mr-2"></i>Try Again
                </button>
            </div>
        `;
    }

    displayResults(result) {
        const confidenceColor = result.confidence >= 85 ? 'green' : result.confidence >= 70 ? 'blue' : 'yellow';
        const confidenceIcon = result.confidence >= 85 ? 'fas fa-check-circle' : result.confidence >= 70 ? 'fas fa-info-circle' : 'fas fa-exclamation-circle';
        
        document.getElementById('resultsSection').innerHTML = `
            <div class="space-y-8 slide-up">
                <!-- Quick Recommendation -->
                <div class="glass-white rounded-3xl p-8 glow-green">
                    <div class="flex items-start gap-4 mb-6">
                        <div class="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                            <i class="fas fa-lightbulb text-white text-xl"></i>
                        </div>
                        <div class="flex-1">
                            <h3 class="text-2xl font-bold text-gray-800 mb-2">🤖 AI Recommendation</h3>
                            <div class="text-lg text-gray-700 leading-relaxed font-medium">${result.recommendation}</div>
                        </div>
                    </div>
                    
                    <div class="grid md:grid-cols-3 gap-4 mb-6">
                        <div class="glass-dark rounded-xl p-4">
                            <div class="flex items-center mb-2">
                                <i class="${confidenceIcon} text-${confidenceColor}-500 mr-2"></i>
                                <span class="text-sm font-medium text-gray-700">Confidence Level</span>
                            </div>
                            <div class="flex items-center">
                                <div class="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                                    <div class="bg-gradient-to-r from-${confidenceColor}-400 to-${confidenceColor}-500 h-2 rounded-full transition-all duration-1000" style="width: ${result.confidence}%"></div>
                                </div>
                                <span class="text-lg font-bold text-${confidenceColor}-600">${result.confidence}%</span>
                            </div>
                        </div>
                        
                        <div class="glass-dark rounded-xl p-4">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-clock text-purple-500 mr-2"></i>
                                <span class="text-sm font-medium text-gray-700">Response Time</span>
                            </div>
                            <div class="text-lg font-bold text-purple-600">${result.responseTime}s</div>
                        </div>
                        
                        <div class="glass-dark rounded-xl p-4">
                            <div class="flex items-center mb-2">
                                <i class="fas fa-brain text-indigo-500 mr-2"></i>
                                <span class="text-sm font-medium text-gray-700">AI Model</span>
                            </div>
                            <div class="text-lg font-bold text-indigo-600">Gemini Pro</div>
                        </div>
                    </div>
                    
                    <div class="glass-dark rounded-xl p-4">
                        <div class="text-sm font-medium text-gray-700 mb-2">💡 Reasoning</div>
                        <div class="text-gray-600">${result.reasoning}</div>
                    </div>
                </div>

                <!-- Detailed Analysis -->
                <div class="space-y-6">
                    ${result.prosAndCons.map((analysis, index) => `
                        <div class="glass-white rounded-3xl p-8 ${analysis.isRecommended ? 'glow' : ''}" style="animation-delay: ${index * 0.1}s">
                            <div class="flex items-center justify-between mb-6">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 ${analysis.isRecommended ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'} rounded-xl flex items-center justify-center">
                                        <span class="text-white font-bold">${index + 1}</span>
                                    </div>
                                    <div>
                                        <h4 class="text-xl font-bold ${analysis.isRecommended ? 'text-blue-800' : 'text-gray-800'}">${analysis.option}</h4>
                                        ${analysis.isRecommended ? '<span class="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium mt-1"><i class="fas fa-star mr-1"></i>Recommended</span>' : ''}
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm text-gray-600 space-y-1">
                                        <div class="flex items-center justify-end">
                                            <span class="mr-2">Risk:</span>
                                            <span class="px-2 py-1 rounded-full text-xs font-medium ${analysis.riskLevel === 'Low' ? 'bg-green-100 text-green-800' : analysis.riskLevel === 'High' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">${analysis.riskLevel || 'Medium'}</span>
                                        </div>
                                        <div class="text-xs text-gray-500">${analysis.timeToResults || 'Medium term'}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="grid md:grid-cols-2 gap-6">
                                <div class="glass-dark rounded-2xl p-6">
                                    <h5 class="font-bold text-green-700 mb-4 flex items-center text-lg">
                                        <i class="fas fa-thumbs-up mr-2"></i>Advantages
                                    </h5>
                                    <ul class="space-y-3">
                                        ${analysis.pros.map(pro => `
                                            <li class="flex items-start group">
                                                <i class="fas fa-check text-green-500 mr-3 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform"></i>
                                                <span class="text-gray-700 leading-relaxed">${pro}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                                
                                <div class="glass-dark rounded-2xl p-6">
                                    <h5 class="font-bold text-red-700 mb-4 flex items-center text-lg">
                                        <i class="fas fa-thumbs-down mr-2"></i>Disadvantages
                                    </h5>
                                    <ul class="space-y-3">
                                        ${analysis.cons.map(con => `
                                            <li class="flex items-start group">
                                                <i class="fas fa-times text-red-500 mr-3 mt-1 flex-shrink-0 group-hover:scale-110 transition-transform"></i>
                                                <span class="text-gray-700 leading-relaxed">${con}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${result.additionalConsiderations && result.additionalConsiderations.length > 0 ? `
                <!-- Additional Considerations -->
                <div class="glass-white rounded-3xl p-8">
                    <h5 class="font-bold text-amber-700 mb-4 flex items-center text-xl">
                        <i class="fas fa-exclamation-circle mr-3 text-amber-500"></i>
                        Additional Considerations
                    </h5>
                    <div class="grid gap-3">
                        ${result.additionalConsiderations.map(consideration => `
                            <div class="flex items-start glass-dark rounded-xl p-4">
                                <i class="fas fa-lightbulb text-amber-500 mr-3 mt-1 flex-shrink-0"></i>
                                <span class="text-gray-700">${consideration}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${result.alternativeApproach ? `
                <!-- Alternative Approach -->
                <div class="glass-white rounded-3xl p-8">
                    <h5 class="font-bold text-purple-700 mb-4 flex items-center text-xl">
                        <i class="fas fa-route mr-3 text-purple-500"></i>
                        Alternative Approach
                    </h5>
                    <div class="glass-dark rounded-xl p-6">
                        <p class="text-gray-700 leading-relaxed">${result.alternativeApproach}</p>
                    </div>
                </div>
                ` : ''}

                <!-- Action Buttons -->
                <div class="grid md:grid-cols-3 gap-4">
                    <button onclick="decisionMaker.saveDecision()" class="btn-primary text-white py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105">
                        <i class="fas fa-bookmark mr-2"></i>Save Decision
                    </button>
                    <button onclick="decisionMaker.getAlternative()" class="btn-secondary text-gray-700 py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105">
                        <i class="fas fa-refresh mr-2"></i>Alternative View
                    </button>
                    <button onclick="decisionMaker.resetForm()" class="btn-secondary text-gray-700 py-4 px-6 rounded-xl transition-all duration-300 hover:scale-105">
                        <i class="fas fa-plus mr-2"></i>New Decision
                    </button>
                </div>
            </div>
        `;
        
        // Scroll to results with smooth animation
        setTimeout(() => {
            document.getElementById('resultsSection').scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }

    saveToHistory(question, result, options, category) {
        const decision = {
            id: Date.now(),
            question: question,
            result: result,
            options: options,
            category: category,
            timestamp: new Date().toISOString()
        };

        this.decisionHistory.unshift(decision);
        
        if (this.decisionHistory.length > 10) {
            this.decisionHistory = this.decisionHistory.slice(0, 10);
        }

        localStorage.setItem('decisionHistory', JSON.stringify(this.decisionHistory));
        this.loadHistory();
    }

    loadHistory() {
        const historyContainer = document.getElementById('decisionHistory');
        
        if (this.decisionHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="text-center py-12">
                    <div class="text-gray-300 text-6xl mb-4">
                        <i class="fas fa-history"></i>
                    </div>
                    <p class="text-gray-500 text-lg">No previous decisions yet</p>
                    <p class="text-gray-400 text-sm mt-2">Make your first decision above to see it here!</p>
                </div>
            `;
            return;
        }

        historyContainer.innerHTML = this.decisionHistory.map((decision, index) => `
            <div class="glass-dark rounded-2xl p-6 hover:bg-white/10 transition-all duration-300 group cursor-pointer" onclick="decisionMaker.showDecisionDetail('${decision.id}')">
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-semibold text-gray-800 flex-1 group-hover:text-indigo-600 transition-colors">${decision.question.length > 80 ? decision.question.substring(0, 80) + '...' : decision.question}</h4>
                    <span class="text-xs text-gray-500 ml-4 flex-shrink-0">${new Date(decision.timestamp).toLocaleDateString()}</span>
                </div>
                <p class="text-sm text-gray-600 mb-3 leading-relaxed">${decision.result.recommendation}</p>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <span class="text-xs px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full font-medium">${this.getCategoryIcon(decision.category)} ${decision.category}</span>
                        <span class="text-xs text-gray-500">Confidence: ${decision.result.confidence}%</span>
                    </div>
                    <i class="fas fa-chevron-right text-gray-400 group-hover:text-indigo-500 transition-colors"></i>
                </div>
            </div>
        `).join('');
    }

    getCategoryIcon(category) {
        const icons = {
            general: '💭',
            career: '💼',
            relationships: '❤️',
            finance: '💰',
            education: '🎓',
            lifestyle: '🌟',
            technology: '💻',
            health: '🏥'
        };
        return icons[category] || '💭';
    }

    updateStats() {
        document.getElementById('totalDecisions').textContent = this.decisionHistory.length;
    }

    async getAlternative() {
        this.showToast('Getting alternative perspective...', 'info');
        await this.getDecision();
    }

    saveDecision() {
        this.showToast('Decision saved to your history!', 'success');
    }

    showDecisionDetail(decisionId) {
        const decision = this.decisionHistory.find(d => d.id == decisionId);
        if (decision) {
            // You could implement a modal here to show full decision details
            this.showToast('Decision details feature coming soon!', 'info');
        }
    }

    resetForm() {
        document.getElementById('decisionQuestion').value = '';
        document.getElementById('additionalContext').value = '';
        document.getElementById('decisionCategory').value = 'general';
        document.getElementById('priorityLevel').value = 'medium';
        
        const container = document.getElementById('optionsContainer');
        container.innerHTML = `
            <div class="flex gap-3 group">
                <div class="relative flex-1">
                    <input type="text" class="w-full p-4 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:border-indigo-400 transition-all duration-300 pr-12" placeholder="Option 1: e.g., Accept the new job offer">
                    <i class="fas fa-grip-vertical absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-300 group-hover:text-gray-500 transition-colors"></i>
                </div>
                <button onclick="removeOption(this)" class="p-4 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all duration-300 hover:scale-105 opacity-0 group-hover:opacity-100">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="flex gap-3 group">
                <div class="relative flex-1">
                    <input type="text" class="w-full p-4 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:border-indigo-400 transition-all duration-300 pr-12" placeholder="Option 2: e.g., Stay at current job">
                    <i class="fas fa-grip-vertical absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-300 group-hover:text-gray-500 transition-colors"></i>
                </div>
                <button onclick="removeOption(this)" class="p-4 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all duration-300 hover:scale-105 opacity-0 group-hover:opacity-100">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.getElementById('resultsSection').classList.add('hidden');
        document.getElementById('charCount').textContent = '0 / 500';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        this.showToast('Form reset! Ready for a new decision.', 'info');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        toast.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg z-50 transform translate-x-full transition-transform duration-300`;
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation' : 'info'} mr-2"></i>
                ${message}
            </div>
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// Utility functions for dynamic option management
function addOption() {
    const container = document.getElementById('optionsContainer');
    const optionCount = container.children.length + 1;
    
    if (optionCount <= 5) {
        const newOption = document.createElement('div');
        newOption.className = 'flex gap-3 group';
        newOption.innerHTML = `
            <div class="relative flex-1">
                <input type="text" class="w-full p-4 bg-white/70 backdrop-blur-sm border border-gray-200 rounded-xl focus:border-indigo-400 transition-all duration-300 pr-12" placeholder="Option ${optionCount}: e.g., Consider another alternative">
                <i class="fas fa-grip-vertical absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-300 group-hover:text-gray-500 transition-colors"></i>
            </div>
            <button onclick="removeOption(this)" class="p-4 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-all duration-300 hover:scale-105 opacity-0 group-hover:opacity-100">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(newOption);
        
        // Focus on the new input
        setTimeout(() => {
            newOption.querySelector('input').focus();
        }, 100);
    } else {
        decisionMaker.showToast('Maximum 5 options allowed!', 'warning');
    }
}

function removeOption(button) {
    const container = document.getElementById('optionsContainer');
    if (container.children.length > 2) {
        button.parentElement.remove();
        decisionMaker.showToast('Option removed', 'info');
    } else {
        decisionMaker.showToast('At least 2 options are required for comparison!', 'warning');
    }
}

function getDecision() {
    decisionMaker.getDecision();
}

// Initialize the app
const decisionMaker = new DecisionMaker();

// Add some nice loading effects on page load
document.addEventListener('DOMContentLoaded', () => {
    // Animate elements on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('slide-up');
            }
        });
    });

    // Observe all glass elements
    document.querySelectorAll('.glass, .glass-white').forEach(el => {
        observer.observe(el);
    });
});