let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let selectedQuestions = [];
let timeLeft = 5400; // 90 phút = 5400 giây
let timerId;
let userAnswers = [];

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Loading questions.json...');
    fetch('questions.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Không thể tải questions.json: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Questions loaded:', data);
            questions = data;
            updateNumQuestionsOptions();
            displayPastScores();
            const startBtn = document.getElementById('start-btn');
            if (startBtn) {
                startBtn.replaceWith(startBtn.cloneNode(true));
                document.getElementById('start-btn').addEventListener('click', startQuiz);
            }
            const nextBtn = document.getElementById('next-btn');
            if (nextBtn) nextBtn.addEventListener('click', nextQuestion);
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) submitBtn.addEventListener('click', confirmSubmit);
            const restartBtn = document.getElementById('restart-btn');
            if (restartBtn) restartBtn.addEventListener('click', restartQuiz);
            const clearScoresBtn = document.getElementById('clear-scores-btn');
            if (clearScoresBtn) {
                clearScoresBtn.addEventListener('click', () => {
                    console.log('Clearing score history...');
                    localStorage.removeItem('quizScores');
                    displayPastScores();
                });
            }
        })
        .catch(error => {
            console.error('Lỗi tải câu hỏi:', error);
            alert('Không thể tải câu hỏi. Vui lòng kiểm tra file questions.json hoặc kết nối mạng.');
            questions = [];
            updateNumQuestionsOptions();
        });
});

function updateNumQuestionsOptions() {
    const select = document.getElementById('num-questions');
    select.innerHTML = '';
    for (let i = 1; i <= questions.length; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        select.appendChild(option);
    }
}

function startQuiz() {
    const numQuestions = parseInt(document.getElementById('num-questions').value);
    console.log('Starting quiz with', numQuestions, 'questions');
    if (questions.length === 0) {
        alert('Không có câu hỏi nào để bắt đầu! Vui lòng kiểm tra file questions.json.');
        document.getElementById('start-screen').style.display = 'block';
        document.getElementById('quiz').style.display = 'none';
        return;
    }
    if (numQuestions < 1 || isNaN(numQuestions)) {
        alert('Vui lòng chọn số lượng câu hỏi hợp lệ!');
        return;
    }
    selectedQuestions = shuffleArray([...questions]).slice(0, Math.min(numQuestions, questions.length));
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];
    timeLeft = 5400;
    document.getElementById('time-left').textContent = Math.floor(timeLeft / 60);
    const quizHeader = document.querySelector('.quiz-header');
    if (quizHeader) {
        quizHeader.style.display = 'flex';
        const scoreValueElement = document.getElementById('score-value');
        if (scoreValueElement) {
            scoreValueElement.textContent = `0/${selectedQuestions.length}`;
            console.log('Score reset in startQuiz to:', scoreValueElement.textContent);
        }
    }
    document.getElementById('start-screen').style.display = 'none';
    const quizElement = document.getElementById('quiz');
    if (quizElement) quizElement.style.display = 'block';
    const pastScores = document.getElementById('past-scores');
    if (pastScores) pastScores.style.display = 'none';
    const clearScoresBtn = document.getElementById('clear-scores-btn');
    if (clearScoresBtn) clearScoresBtn.style.display = 'none';
    startTimer();
    const gridContainer = document.querySelector('#question-grid .grid');
    gridContainer.innerHTML = '';
    const numCols = Math.ceil(Math.sqrt(selectedQuestions.length));
    gridContainer.style.setProperty('--grid-columns', numCols);
    selectedQuestions.forEach((_, index) => {
        const box = document.createElement('div');
        box.className = 'question-box unanswered';
        box.innerText = index + 1;
        box.dataset.index = index;
        box.onclick = () => jumpToQuestion(index);
        gridContainer.appendChild(box);
    });
    loadQuestion();
}

function jumpToQuestion(index) {
    if (index >= 0 && index < selectedQuestions.length && index !== currentQuestionIndex) {
        currentQuestionIndex = index;
        loadQuestion();
    }
}

function loadQuestion() {
    console.log('Loading question', currentQuestionIndex + 1, 'of', selectedQuestions.length);
    if (currentQuestionIndex >= selectedQuestions.length) {
        showResult();
        return;
    }
    const questionData = selectedQuestions[currentQuestionIndex];
    if (!questionData || !questionData.options || !questionData.correct) {
        console.error('Invalid question data:', questionData);
        alert('Câu hỏi không hợp lệ! Vui lòng kiểm tra questions.json.');
        return;
    }
    document.getElementById('question').innerText = `Câu ${currentQuestionIndex + 1}/${selectedQuestions.length}: ${questionData.question}`;
    document.getElementById('progress').style.width = `${((currentQuestionIndex + 1) / selectedQuestions.length * 100)}%`;
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    document.getElementById('feedback').innerText = '';
    document.getElementById('next-btn').disabled = true;
    selectedOption = null;
    if (!userAnswers[currentQuestionIndex]) {
        const optionKeys = shuffleArray(Object.keys(questionData.options).filter(key => questionData.options[key] !== ''));
        optionKeys.forEach(key => {
            const button = document.createElement('button');
            button.className = 'option';
            button.innerText = `${key}. ${questionData.options[key]}`;
            button.onclick = () => selectOption(button, key);
            optionsDiv.appendChild(button);
        });
    } else {
        const answer = userAnswers[currentQuestionIndex];
        const correct = questionData.correct;
        const optionKeys = Object.keys(questionData.options).filter(key => questionData.options[key] !== '');
        optionKeys.forEach(key => {
            const button = document.createElement('button');
            button.className = 'option';
            button.innerText = `${key}. ${questionData.options[key]}`;
            button.disabled = true;
            if (key === correct) button.classList.add('correct');
            else if (key === answer.selected && answer.selected !== correct) button.classList.add('incorrect');
            optionsDiv.appendChild(button);
        });
        const feedback = document.getElementById('feedback');
        if (answer.selected === null) {
            feedback.innerText = `Hết thời gian! Đáp án đúng: ${correct}. ${questionData.options[correct]}`;
            feedback.style.color = 'red';
        } else if (answer.correct) {
            feedback.innerText = 'Đúng!';
            feedback.style.color = 'green';
        } else {
            feedback.innerText = `Sai! Đáp án đúng: ${correct}. ${questionData.options[correct]}`;
            feedback.style.color = 'red';
        }
        document.getElementById('next-btn').disabled = false;
    }
}

function startTimer() {
    clearInterval(timerId);
    timerId = setInterval(() => {
        timeLeft--;
        const minutesLeft = Math.floor(timeLeft / 60);
        document.getElementById('time-left').textContent = minutesLeft;
        if (timeLeft <= 300) { // Còn 5 phút
            document.getElementById('time-left').classList.add('warning');
        }
        if (timeLeft <= 0) {
            clearInterval(timerId);
            alert('Hết thời gian! Bài thi của bạn đã kết thúc.');
            showResult();
        }
    }, 1000);
}

function selectOption(button, option) {
    if (selectedOption) return;
    selectedOption = option;
    const correct = selectedQuestions[currentQuestionIndex].correct;
    const feedback = document.getElementById('feedback');
    document.querySelectorAll('.option').forEach(btn => {
        btn.disabled = true;
        const btnKey = btn.innerText.split('.')[0];
        if (btnKey === correct) btn.classList.add('correct');
        else if (btnKey === option && option !== correct) btn.classList.add('incorrect');
    });
    if (option === null) {
        feedback.innerText = `Hết thời gian! Đáp án đúng: ${correct}. ${selectedQuestions[currentQuestionIndex].options[correct]}`;
        feedback.style.color = 'red';
        userAnswers[currentQuestionIndex] = { id: selectedQuestions[currentQuestionIndex].id, selected: null, correct: false };
    } else if (option === correct) {
        feedback.innerText = 'Đúng!';
        feedback.style.color = 'green';
        score++;
        const scoreValueElement = document.getElementById('score-value');
        if (scoreValueElement) {
            scoreValueElement.textContent = `${score}/${selectedQuestions.length}`;
        }
        userAnswers[currentQuestionIndex] = { id: selectedQuestions[currentQuestionIndex].id, selected: option, correct: true };
    } else {
        feedback.innerText = `Sai! Đáp án đúng: ${correct}. ${selectedQuestions[currentQuestionIndex].options[correct]}`;
        feedback.style.color = 'red';
        userAnswers[currentQuestionIndex] = { id: selectedQuestions[currentQuestionIndex].id, selected: option, correct: false };
    }
    const box = document.querySelector(`.question-box[data-index="${currentQuestionIndex}"]`);
    if (box) {
        box.classList.remove('unanswered');
        box.classList.add('answered');
    }
    document.getElementById('next-btn').disabled = false;
}

function confirmSubmit() {
    if (confirm('Bạn có chắc chắn muốn nộp bài không?')) {
        clearInterval(timerId);
        showResult();
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    loadQuestion();
}

function saveScore() {
    const pastScores = JSON.parse(localStorage.getItem('quizScores') || '[]');
    pastScores.push({
        score: `${score}/${selectedQuestions.length}`,
        percentage: (score / selectedQuestions.length * 100).toFixed(2),
        date: new Date().toLocaleString('vi-VN')
    });
    localStorage.setItem('quizScores', JSON.stringify(pastScores));
}

function displayPastScores() {
    const pastScores = JSON.parse(localStorage.getItem('quizScores') || '[]');
    const pastScoresDiv = document.getElementById('past-scores');
    if (pastScoresDiv) {
        pastScoresDiv.innerHTML = '<h3>Lịch sử điểm:</h3>';
        if (pastScores.length === 0) {
            pastScoresDiv.innerHTML += '<p>Chưa có kết quả nào.</p>';
        } else {
            pastScores.forEach(score => {
                const p = document.createElement('p');
                p.innerText = `Ngày ${score.date}: ${score.score} (${score.percentage}%)`;
                pastScoresDiv.appendChild(p);
            });
        }
    }
}

function showResult() {
    clearInterval(timerId);
    saveScore();
    document.getElementById('quiz').style.display = 'none';
    const resultDiv = document.getElementById('result');
    if (resultDiv) resultDiv.style.display = 'block';
    const quizHeader = document.querySelector('.quiz-header');
    if (quizHeader) quizHeader.style.display = 'none';
    const resultScoreElement = document.getElementById('result-score');
    if (resultScoreElement) {
        resultScoreElement.innerHTML = '';
        const scoreText = document.createElement('div');
        scoreText.className = 'score-text';
        scoreText.innerText = `Bạn trả lời đúng ${score}/${selectedQuestions.length} câu`;
        resultScoreElement.appendChild(scoreText);
        const percentageText = document.createElement('div');
        percentageText.className = 'percentage-text';
        percentageText.innerText = `Tỷ lệ đúng: ${(score / selectedQuestions.length * 100).toFixed(2)}%`;
        resultScoreElement.appendChild(percentageText);
        console.log('Result displayed: Bạn trả lời đúng', score, '/', selectedQuestions.length, 'câu');
    }
    const detailedResults = document.getElementById('detailed-results');
    if (detailedResults) {
        detailedResults.innerHTML = '<h3>Chi tiết câu trả lời:</h3>';
        userAnswers.forEach((answer, index) => {
            if (answer) {
                const question = selectedQuestions[index];
                const resultText = answer.correct
                    ? `Câu ${question.id}: Đúng (Bạn chọn ${answer.selected})`
                    : `Câu ${question.id}: Sai (Bạn chọn ${answer.selected || 'Không chọn'}, Đáp án đúng: ${question.correct})`;
                const p = document.createElement('p');
                p.innerText = resultText;
                p.style.color = answer.correct ? 'green' : 'red';
                detailedResults.appendChild(p);
            }
        });
    }
}

function restartQuiz() {
    console.log('Restarting quiz...');
    currentQuestionIndex = 0;
    score = 0;
    selectedOption = null;
    selectedQuestions = [];
    userAnswers = [];
    clearInterval(timerId);
    const scoreValueElement = document.getElementById('score-value');
    if (scoreValueElement) {
        scoreValueElement.textContent = `0/0`;
        console.log('Score reset in restartQuiz to:', scoreValueElement.textContent);
    }
    const quizHeader = document.querySelector('.quiz-header');
    if (quizHeader) quizHeader.style.display = 'none';
    document.getElementById('quiz').style.display = 'none';
    document.getElementById('result').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    const pastScores = document.getElementById('past-scores');
    if (pastScores) pastScores.style.display = 'block';
    const clearScoresBtn = document.getElementById('clear-scores-btn');
    if (clearScoresBtn) clearScoresBtn.style.display = 'block';
    updateNumQuestionsOptions();
    displayPastScores();
}
