# Quizzatron

<p align="center">
    <img src="assets/logo.png" alt="Logo" border="0">
    <br>We one-up QuizUp!

---

<p align="center">
    <a href="https://github.com/SVijayB/Quizzatron/pulls">
        <img src="https://img.shields.io/github/issues-pr/SVijayB/Quizzatron.svg?style=for-the-badge&amp;logo=opencollective" alt="GitHub pull-requests">
    </a>
<a href="https://github.com/SVijayB/Quizzatron/issues">
    <img src="https://img.shields.io/github/issues/SVijayB/Quizzatron.svg?style=for-the-badge&amp;logo=testcafe" alt="GitHub issues">
    </a>
<a href="https://github.com/SVijayB/Quizzatron/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/SVijayB/Quizzatron.svg?style=for-the-badge&amp;logo=bandsintown" alt="GitHub contributors">
    </a>
<a href="https://github.com/SVijayB/Quizzatron/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/SVijayB/Quizzatron?style=for-the-badge&amp;logo=appveyor" alt="GitHub license">
    </a>
<a href="https://github.com/SVijayB/Quizzatron">
    <img src="https://img.shields.io/github/repo-size/SVijayB/Quizzatron?style=for-the-badge&amp;logo=git" alt="GitHub repo size">
    </a>
<a href="https://github.com/SVijayB/Quizzatron/blob/master/.github/CODE_OF_CONDUCT.md">
    <img src="https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=for-the-badge&amp;logo=crowdsource" alt="Code of Conduct">
    </a>
<a href="https://github.com/SVijayB/Quizzatron/blob/master/.github/CONTRIBUTING.md">
    <img src="https://img.shields.io/static/v1?style=for-the-badge&amp;logo=opensourceinitiative&amp;label=Open&amp;message=Source%20%E2%9D%A4%EF%B8%8F&amp;color=blueviolet" alt="Open Source Love svg1">
    </a>
    <br>
<a href="https://codecov.io/gh/SVijayB/Quizzatron" > 
    <img src="https://img.shields.io/codecov/c/github/SVijayB/quizzatron?style=for-the-badge&logo=codecov" alt="Code Coverage"> 
    </a>
<a href="https://github.com/SVijayB/Quizzatron/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/SVijayB/Quizzatron/ci-test.yml?style=for-the-badge&logo=github" alt="Build Status">
    </a>
</p>

## Project Type

Application

## Team Members

#### Akshay Ravi

#### Aravindh Manavalan

#### Hariharan Sureshkumar

#### Vijay Balaji

## Table of Contents

-   [Our Goal](#our-goal)
-   [Motivation](#Motivation)
-   [Installation](#Installation)
-   [Usage](#Usage)
-   [Directory Summary](#directory-summary)
    -   [Project Demo](#Demo)
-   [Contributing](#Contributing)
-   [License](#License)

## Our Goal

Create an AI-powered quizzing platform that generates engaging, customizable quizzes on any topic, enhancing learning through gamification.

## Motivation

<!--- Insert product screenshot below --->

![Product Screenshot](https://media.giphy.com/media/L1R1tvI9svkIWwpVYr/giphy.gif)

We’re building an AI-powered quizzing system that can generate questions on any topic - SATs, movies, national flags, or whatever you choose! The application supports custom inputs like PDFs or images and can also generate quizzes autonomously using DeepSeek. It provides an engaging learning experience with minimal human input.

To maximize accessibility, our model integrates with APIs, allowing it to function as a Discord bot, a web interface, or a CLI tool. But we didn’t stop there, we wanted to make quizzing fun. Inspired by **QuizUp**, we focused on gamification, incorporating features that users love based on insights from [community discussions](https://www.reddit.com/r/QuizUp/comments/1ahl958/what_the_hell_happened_to_quizup/).

We also used some standard open source trivia data, such as the [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA) and the [opentdb API](https://opentdb.com/).

## Installation

<!--- Provide instructions on installing the application --->

For the latest stable version, head to [Releases](https://github.com/SVijayB/Quizzatron/releases).

Download and extract the source code.

As an alternative, you could also clone the repository using,

`git clone https://github.com/SVijayB/Quizzatron.git`

`cd Quizzatron`

Method 1: Using the run.py script

The easiest way to get started is to use our setup script, which handles everything automatically:
`python run.py`

The script will:

1. Check for Node.js and npm (providing installation instructions if needed)
2. Install all required backend and frontend dependencies
3. Start the Flask API server
4. Start the frontend development server (if Node.js is available)
5. Automatically open the frontend application in your browser

Method 2: Manual setup

Alternatively, you can set up manually:

1. Create a virtual environment:

```
 python -m venv venv
```

2. Activate the virtual environment:

    On Windows: `venv\Scripts\activate`

    On macOS/Linux: `source venv/bin/activate`

3. Install dependencies:

```
 pip install -r requirements.txt
```

4. If you want to run the frontend:

```
cd frontend
npm install
npm run dev
```

5. In a separate terminal, run the backend:

```
 python -m api.app
```

## Usage

<!--- Provide instructions on how to use the application after installing it --->

Running with the script

Simply run:

```
python run.py
```

Development Mode

To run in development mode with hot reloading:

```
QUIZZATRON_DEV=true python run.py
```

On Windows:

```
set QUIZZATRON_DEV=true
python run.py
```

Environment Variables

You can customize the application behavior with these environment variables:

```
QUIZZATRON_HOST: Host address for backend (default: 127.0.0.1)
QUIZZATRON_PORT: Port number for backend (default: 5000)
QUIZZATRON_DEV: Set to "true" for development mode (default: false)
QUIZZATRON_FRONTEND_PORT: Port number for frontend (default: 8080)
```

Example:

```
QUIZZATRON_PORT=8000 QUIZZATRON_FRONTEND_PORT=8080 python run.py
```

<!--- You can also add in screenshots, app demo (Gif format) or even provide link to other resources --->

## Directory Summary

```
├───api
│   ├───routes
│   ├───services
│   ├───templates
│   └───utils
├───assets
├───docs
│   ├───specs
│   └───technology_review
│       ├───demo_output
│       └───demo_scripts
├───frontend
│   ├───public
│   └───src
│       ├───components
│       │   ├───quiz
│       │   └───ui
│       ├───hooks
│       ├───lib
│       └───pages
├───scripts
└───tests
    ├───routes
    ├───services
    └───utils
```

### Project demo

![Project demo](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMTJlODMxMDg0ZWJjOGFmNTdjYzczZTMwZTIyNzM3YTExZWMxMzM2OCZjdD1n/wwg1suUiTbCY8H8vIA/giphy-downsized-large.gif)

You can also find the demo video [here](https://www.youtube.com/watch?v=dQw4w9WgXcQ).

## Contributing

To contribute to Quizzatron, fork the repository, create a new branch and send us a pull request. Make sure you read [CONTRIBUTING.md](https://github.com/SVijayB/Quizzatron/blob/master/.github/CONTRIBUTING.md) before sending us Pull requests.

Thanks for contributing to Open-source! ❤️

Project contributors ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

Quizzatron is under The MIT License. Read the [LICENSE](https://github.com/SVijayB/Quizzatron/blob/master/LICENSE) file for more information.

---

<img src="assets/footercredits.png" width = "600px">
