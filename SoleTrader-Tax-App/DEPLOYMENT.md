# 🚀 Deployment Guide - Sole Trader Tax Tracker

## Complete guide to deploy your app and publish to Google Play Store

---

## 📋 Prerequisites

1. **GitHub Account** (free) - https://github.com
2. **Google Play Developer Account** ($25 one-time) - https://play.google.com/console
3. **Node.js installed** (for building Android app) - https://nodejs.org

---

## STEP 1: Generate App Icons 🎨

1. Open `generate-icons.html` in your browser
2. Click **"Generate All Icons"**
3. Download all 8 icon sizes
4. Save them in your app folder (replace the placeholder references)

---

## STEP 2: Deploy to GitHub Pages 🌐

### A. Create GitHub Repository

1. Go to https://github.com and sign in
2. Click **"New repository"** (green button)
3. Name it: `sole-trader-tax`
4. Make it **Public**
5. Click **"Create repository"**

### B. Upload Your Code

**Option 1: Using GitHub Desktop (Easiest)**
1. Download GitHub Desktop: https://desktop.github.com
2. Install and sign in
3. Click **"Add"** → **"Add Existing Repository"**
4. Select your `SoleTrader-Tax-App` folder
5. Click **"Publish repository"**

**Option 2: Using Command Line**
```bash
cd C:\Users\Kieren\OneDrive\Desktop\SoleTrader-Tax-App
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sole-trader-tax.git
git push -u origin main
```

### C. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Pages** in left sidebar
4. Under "Build and deployment":
   - Source: **GitHub Actions**
5. Wait 2-3 minutes
6. Your app will be live at: `https://YOUR-USERNAME.github.io/sole-trader-tax/`

---

## STEP 3: Test Your Live App 📱

1. Open the GitHub Pages URL on your phone
2. Test all features
3. Try installing it:
   - **Android**: Chrome menu → "Add to Home Screen"
   - **iOS**: Safari Share → "Add to Home Screen"

---

## STEP 4: Build Android App 📦

### A. Install Bubblewrap CLI

Open PowerShell or Command Prompt:
```bash
npm install -g @bubblewrap/cli
```

### B. Update Build Script

1. Open `build-android.bat` in a text editor
2. Replace `YOUR-USERNAME` with your actual GitHub username
3. Save the file

### C. Initialize Android Project

```bash
cd C:\Users\Kieren\OneDrive\Desktop\SoleTrader-Tax-App
bubblewrap init --manifest https://YOUR-USERNAME.github.io/sole-trader-tax/manifest.json
```

**Answer the prompts:**
- App name: `Sole Trader Tax Tracker`
- Package name: `com.yourname.soletrader` (use lowercase, no spaces)
- Host: Your GitHub Pages URL
- Start URL: `/sole-trader-tax/`
- Theme color: `#4F46E5`
- Navigation color: `#4F46E5`
- Display mode: `standalone`
- Orientation: `portrait`

### D. Build the APK

**Easy way - Double click:**
- Double-click `build-android.bat`

**Or run manually:**
```bash
bubblewrap build
```

This creates: `app-release-signed.apk`

---

## STEP 5: Publish to Google Play Store 🏪

### A. Create Google Play Developer Account

1. Go to https://play.google.com/console
2. Click **"Create account"**
3. Pay $25 registration fee (one-time)
4. Complete identity verification

### B. Create New App

1. Click **"Create app"**
2. Fill in details:
   - **App name**: Sole Trader Tax Tracker
   - **Default language**: English (UK)
   - **App or game**: App
   - **Free or paid**: Free
3. Accept declarations
4. Click **"Create app"**

### C. Set Up App Details

**Store Listing:**
- **Short description**: "Track income, expenses, mileage & calculate tax for sole traders"
- **Full description**: Use content from README.md
- **App icon**: Upload your 512x512 icon
- **Screenshots**: Take 2-4 screenshots on your phone
- **Category**: Business
- **Contact email**: Your email

**App Content:**
- Privacy policy: "All data stored locally on device. No data collected."
- Target audience: Adults
- Content rating: Fill questionnaire (should be rated Everyone)

### D. Upload APK/AAB

1. Go to **"Production"** → **"Create new release"**
2. Click **"Upload"**
3. Select `app-release-signed.apk` or `.aab` file
4. Add release notes: "Initial release - Track income, expenses, tax"
5. Click **"Save"**
6. Click **"Review release"**
7. Click **"Start rollout to Production"**

### E. Wait for Review

- Google reviews in 1-7 days
- You'll get email when approved
- App goes live automatically!

---

## 🎯 Alternative: Test Without Play Store

### Use PWA Builder (Faster!)

1. Go to https://www.pwabuilder.com
2. Enter your GitHub Pages URL
3. Click **"Start"**
4. Click **"Package For Stores"**
5. Select **"Android"**
6. Download the package
7. Upload to Google Play

---

## 📊 Marketing Your App

### App Store Optimization

**Title**: Sole Trader Tax Tracker - Income & Expense Manager

**Keywords**:
- sole trader
- self employed
- tax calculator
- expense tracker
- mileage tracker
- income tracker
- small business
- HMRC
- tax return

**Promotional Text**:
"Stop worrying about tax time! Track your income, expenses, and mileage throughout the year. Automatically calculate how much tax you owe. Perfect for sole traders, self-employed workers, and small business owners."

---

## 🔧 Troubleshooting

### App won't build?
- Install Java JDK: https://www.oracle.com/java/technologies/downloads/
- Install Android SDK via Android Studio

### GitHub Pages not working?
- Check repository is public
- Wait 5 minutes after enabling Pages
- Check Actions tab for deployment status

### Icons not showing?
- Make sure all icon files are in root folder
- Check manifest.json paths match icon filenames

---

## 📞 Support Checklist

Before submitting to Play Store, verify:
- ✅ App works on GitHub Pages
- ✅ All icons generated (72-512px)
- ✅ Manifest.json has correct URLs
- ✅ Service worker caches correctly
- ✅ App installs on your phone
- ✅ All features work offline
- ✅ No console errors
- ✅ Privacy policy written
- ✅ Screenshots taken (minimum 2)

---

## 🎉 Success Metrics

After publishing, track:
- Downloads
- Active users
- User ratings
- Crash reports
- Feature requests

**Update your app regularly** to keep users engaged!

---

## 🚀 Next Steps After Launch

1. **Monitor reviews** - Respond to user feedback
2. **Add features** - Based on user requests
3. **Fix bugs** - Check Play Console for crash reports
4. **Market your app** - Social media, forums, SEO
5. **Update regularly** - Keep users engaged

---

**Good luck with your launch! 🎊**

For help: Check GitHub Issues or Play Console documentation
