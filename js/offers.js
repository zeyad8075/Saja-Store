import { supabase } from "./supabase.js";

let sliderState = {
    currentSlide: 0,
    totalSlides: 0,
    slideInterval: null
};

let isOffersLoading = false;
let isSliderInitialized = false;
let currentEditingOfferId = null;
let offerImageInput, offerImageUploadBox, offerImagePreview, removeOfferImageBtn;

let imagesLoadedCount = 0;
let totalImagesToLoad = 0;
let offersCache = [];

function initSlider(reset = false) {
    if (isSliderInitialized && !reset) {
        return;
    }
    
    const sliderTrack = document.getElementById('slider-track');
    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.getElementById('prev-slide');
    const nextBtn = document.getElementById('next-slide');
    const sliderDots = document.getElementById('slider-dots');
    
    if (!sliderTrack || !slides.length) {
        setTimeout(() => initSlider(reset), 500);
        return;
    }
    
    if (reset) {
        if (sliderState.slideInterval) {
            clearInterval(sliderState.slideInterval);
            sliderState.slideInterval = null;
        }
        sliderState = {
            currentSlide: 0,
            totalSlides: slides.length,
            slideInterval: null
        };
    } else {
        sliderState.totalSlides = slides.length;
    }
    
    function updateSlider() {
        if (sliderTrack) {
            sliderTrack.style.transform = `translateX(-${sliderState.currentSlide * 100}%)`;
            
            const dots = document.querySelectorAll('.slider-dot');
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === sliderState.currentSlide);
            });
        }
    }
    
    function nextSlide() {
        if (sliderState.totalSlides > 0) {
            sliderState.currentSlide = (sliderState.currentSlide + 1) % sliderState.totalSlides;
            updateSlider();
        }
    }
    
    function prevSlide() {
        if (sliderState.totalSlides > 0) {
            sliderState.currentSlide = (sliderState.currentSlide - 1 + sliderState.totalSlides) % sliderState.totalSlides;
            updateSlider();
        }
    }
    
    if (prevBtn) prevBtn.onclick = prevSlide;
    if (nextBtn) nextBtn.onclick = nextSlide;
    
    if (sliderDots && sliderState.totalSlides > 0) {
        createSliderDots(sliderDots, sliderState.totalSlides);
    }
    
    waitForImagesToLoad(() => {
        setupAutoPlay(nextSlide);
    });
    
    setupTouchSwipe(sliderTrack, prevSlide, nextSlide);
    updateSlider();
    
    isSliderInitialized = true;
}

function waitForImagesToLoad(callback) {
    const sliderImages = document.querySelectorAll('.slide img');
    totalImagesToLoad = sliderImages.length;
    imagesLoadedCount = 0;
    
    if (totalImagesToLoad === 0) {
        callback();
        return;
    }
    
    let loadedCalled = false;
    
    sliderImages.forEach(img => {
        if (img.complete && img.naturalHeight !== 0) {
            imagesLoadedCount++;
            if (!loadedCalled && imagesLoadedCount >= totalImagesToLoad) {
                loadedCalled = true;
                setTimeout(callback, 300);
            }
        } else {
            const onLoad = () => {
                imagesLoadedCount++;
                if (!loadedCalled && imagesLoadedCount >= totalImagesToLoad) {
                    loadedCalled = true;
                    setTimeout(callback, 300);
                }
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
            };
            
            const onError = () => {
                imagesLoadedCount++;
                if (!loadedCalled && imagesLoadedCount >= totalImagesToLoad) {
                    loadedCalled = true;
                    setTimeout(callback, 300);
                }
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
            };
            
            img.addEventListener('load', onLoad);
            img.addEventListener('error', onError);
        }
    });
}

function checkAllImagesLoaded(callback) {
    if (imagesLoadedCount >= totalImagesToLoad) {
        setTimeout(callback, 500);
    }
}

function createSliderDots(sliderDots, totalSlides) {
    if (!sliderDots) return;
    
    sliderDots.innerHTML = '';
    
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement('button');
        dot.className = 'slider-dot';
        dot.setAttribute('aria-label', `انتقل إلى الشريحة ${i + 1}`);
        
        if (i === sliderState.currentSlide) {
            dot.classList.add('active');
        }
        
        dot.addEventListener('click', () => {
            sliderState.currentSlide = i;
            const sliderTrack = document.getElementById('slider-track');
            if (sliderTrack) {
                sliderTrack.style.transform = `translateX(-${i * 100}%)`;
                
                const dots = document.querySelectorAll('.slider-dot');
                dots.forEach((d, idx) => {
                    d.classList.toggle('active', idx === i);
                });
            }
        });
        
        sliderDots.appendChild(dot);
    }
}

function setupAutoPlay(nextSlide) {
    if (sliderState.slideInterval) {
        clearInterval(sliderState.slideInterval);
        sliderState.slideInterval = null;
    }
    
    if (sliderState.totalSlides <= 1) {
        return;
    }
    
    sliderState.slideInterval = setInterval(() => {
        nextSlide();
    }, 5000);
}

function setupTouchSwipe(sliderTrack, prevSlide, nextSlide) {
    if (!sliderTrack) return;
    
    let startX = 0;
    let endX = 0;
    let isDragging = false;
    
    sliderTrack.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });
    
    sliderTrack.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        endX = e.touches[0].clientX;
    });
    
    sliderTrack.addEventListener('touchend', () => {
        if (!isDragging) return;
        
        const diff = startX - endX;
        const swipeThreshold = 50;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                nextSlide();
            } else {
                prevSlide();
            }
        }
        
        isDragging = false;
        startX = 0;
        endX = 0;
    });
}

function initializeOfferManagement() {
    try {
        initializeOfferElements();
        loadOffers();
        setupGlobalEventDelegation();
    } catch (error) {
        setTimeout(initializeOfferManagement, 1000);
    }
}

function initializeOfferElements() {
    offerImageInput = document.getElementById('offer-image');
    offerImageUploadBox = document.getElementById('offer-image-upload-box');
    offerImagePreview = document.getElementById('offer-image-preview');
    removeOfferImageBtn = document.getElementById('remove-offer-image');
    
    if (!offerImageInput || !offerImageUploadBox) {
        setTimeout(initializeOfferElements, 500);
        return;
    }
    
    setupOfferImageEvents();
    setupOfferButtons();
}

function setupOfferImageEvents() {
    if (offerImageUploadBox) {
        offerImageUploadBox.addEventListener('click', () => {
            if (offerImageInput) {
                offerImageInput.click();
            }
        });
    }
    
    if (offerImageInput) {
        offerImageInput.addEventListener('change', handleOfferImageChange);
    }
    
    if (removeOfferImageBtn) {
        removeOfferImageBtn.addEventListener('click', handleRemoveOfferImage);
    }
}

function handleOfferImageChange() {
    if (this.files && this.files[0]) {
        const file = this.files[0];
        
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            alert('❌ نوع الملف غير مدعوم. يرجى اختيار صورة (JPG, PNG, WebP, GIF)');
            this.value = '';
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('❌ حجم الصورة كبير جداً. الحد الأقصى 5MB');
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            if (offerImagePreview) {
                offerImagePreview.src = e.target.result;
                offerImagePreview.style.display = 'block';
            }
            if (offerImageUploadBox) {
                offerImageUploadBox.classList.add('has-image');
            }
            if (removeOfferImageBtn) {
                removeOfferImageBtn.style.display = 'inline-block';
            }
        };
        reader.onerror = function() {
            alert('❌ حدث خطأ في قراءة الصورة');
            this.value = '';
        };
        reader.readAsDataURL(file);
    }
}

function handleRemoveOfferImage() {
    if (offerImageInput) offerImageInput.value = '';
    if (offerImagePreview) {
        offerImagePreview.style.display = 'none';
        offerImagePreview.src = '#';
    }
    if (offerImageUploadBox) {
        offerImageUploadBox.classList.remove('has-image');
    }
    if (removeOfferImageBtn) {
        removeOfferImageBtn.style.display = 'none';
    }
}

function setupOfferButtons() {
    const addOfferBtn = document.getElementById('add-offer-btn');
    const cancelOfferBtn = document.getElementById('cancel-offer-btn');
    const offerForm = document.getElementById('offer-form');
    
    if (addOfferBtn) {
        addOfferBtn.addEventListener('click', showOfferForm);
    }
    
    if (cancelOfferBtn) {
        cancelOfferBtn.addEventListener('click', hideOfferForm);
    }
    
    if (offerForm) {
        offerForm.addEventListener('submit', handleOfferFormSubmit);
    }
}

function showOfferForm() {
    currentEditingOfferId = null;
    const offerFormContainer = document.getElementById('offer-form-container');
    const offerForm = document.getElementById('offer-form');
    
    if (offerForm) {
        offerForm.reset();
        offerForm.querySelector('button[type="submit"]').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة العرض';
    }
    
    resetOfferImagePreview();
    
    if (offerFormContainer) {
        offerFormContainer.style.display = 'block';
        offerFormContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

function resetOfferImagePreview() {
    if (offerImagePreview) {
        offerImagePreview.style.display = 'none';
        offerImagePreview.src = '#';
    }
    if (offerImageUploadBox) {
        offerImageUploadBox.classList.remove('has-image');
    }
    if (removeOfferImageBtn) {
        removeOfferImageBtn.style.display = 'none';
    }
}

function hideOfferForm() {
    const offerFormContainer = document.getElementById('offer-form-container');
    if (offerFormContainer) {
        offerFormContainer.style.display = 'none';
    }
    
    currentEditingOfferId = null;
}

function validateOfferData(offerData) {
    const errors = [];
    
    if (!offerData.title?.trim()) {
        errors.push('⭕ عنوان العرض مطلوب');
    } else if (offerData.title.trim().length < 3) {
        errors.push('⭕ العنوان قصير جداً (3 أحرف على الأقل)');
    }
    
    if (!offerData.description?.trim()) {
        errors.push('⭕ وصف العرض مطلوب');
    } else if (offerData.description.trim().length < 10) {
        errors.push('⭕ الوصف قصير جداً (10 أحرف على الأقل)');
    }
    
    if (!offerData.button_text?.trim()) {
        errors.push('⭕ نص زر العرض مطلوب');
    }
    
    if (offerData.link && offerData.link.trim()) {
        try {
            new URL(offerData.link);
        } catch {
            errors.push('⭕ رابط العرض غير صالح');
        }
    }
    
    return errors;
}

async function handleOfferFormSubmit(e) {
    e.preventDefault();
    
    const saveOfferBtn = document.getElementById('save-offer-btn');
    const originalText = saveOfferBtn?.innerHTML || '';
    
    try {
        if (saveOfferBtn) {
            saveOfferBtn.disabled = true;
            saveOfferBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        }
        
        const offerData = collectOfferFormData();
        const validationErrors = validateOfferData(offerData);
        if (validationErrors.length > 0) {
            alert('❌ يرجى تصحيح الأخطاء التالية:\n\n' + validationErrors.join('\n'));
            return;
        }

        const imageFile = offerImageInput?.files[0];
        if (imageFile) {
            offerData.image_url = await uploadOfferImage(imageFile);
        } else if (!currentEditingOfferId && !document.getElementById('current-offer-image')?.src.includes('data:')) {
            alert('⚠️ يرجى اختيار صورة للعرض');
            return;
        }

        if (currentEditingOfferId) {
            await updateOffer(currentEditingOfferId, offerData);
        } else {
            await addOffer(offerData);
        }
        
        hideOfferForm();
        await loadOffers();
        
    } catch (error) {
        alert('❌ حدث خطأ في حفظ العرض: ' + error.message);
    } finally {
        if (saveOfferBtn) {
            saveOfferBtn.disabled = false;
            saveOfferBtn.innerHTML = originalText;
        }
    }
}

function collectOfferFormData() {
    return {
        title: document.getElementById('offer-title')?.value || '',
        description: document.getElementById('offer-description')?.value || '',
        button_text: document.getElementById('offer-button-text')?.value || 'تسوق الآن',
        link: document.getElementById('offer-link')?.value || '#products'
    };
}

async function loadOffers() {
    if (isOffersLoading) {
        return;
    }
    
    isOffersLoading = true;
    
    try {
        if (!supabase) {
            throw new Error('لا يوجد اتصال بقاعدة البيانات');
        }
        
        const { data: offers, error } = await supabase
            .from('offers')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        offersCache = offers || [];
        
        displayOffers(offersCache);
        
        setTimeout(() => {
            displayOffersSlider(offersCache);
        }, 200);
        
        return offersCache;
        
    } catch (error) {
        handleOffersLoadError();
        return [];
    } finally {
        isOffersLoading = false;
    }
}

function handleOffersLoadError() {
    const offersGrid = document.getElementById('offers-grid');
    const sliderTrack = document.getElementById('slider-track');
    
    if (offersGrid) {
        offersGrid.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>حدث خطأ في تحميل العروض</p>
                <p style="font-size: 14px; color: #666;">تحقق من اتصال الإنترنت أو قاعدة البيانات</p>
                <button class="retry-btn" id="retry-offers-btn">
                    <i class="fas fa-redo"></i> إعادة المحاولة
                </button>
            </div>
        `;
        
        setTimeout(() => {
            const retryBtn = document.getElementById('retry-offers-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', loadOffers);
            }
        }, 100);
    }
    
    if (sliderTrack) {
        sliderTrack.innerHTML = getDefaultSlideHTML();
        setTimeout(() => initSlider(true), 100);
    }
}

function displayOffers(offers) {
    const offersGrid = document.getElementById('offers-grid');
    if (!offersGrid) {
        return;
    }
    
    if (!offers || offers.length === 0) {
        offersGrid.innerHTML = getNoOffersHTML();
        setTimeout(() => {
            const addFirstBtn = document.getElementById('add-first-offer-btn');
            if (addFirstBtn) {
                addFirstBtn.addEventListener('click', showOfferForm);
            }
        }, 100);
        return;
    }
    
    offersGrid.innerHTML = offers.map(offer => getOfferCardHTML(offer)).join('');
}

function getNoOffersHTML() {
    return `
        <div class="no-offers">
            <i class="fas fa-images" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></i>
            <p style="color: #666; margin-bottom: 20px;">لا توجد عروض حالياً</p>
            <button class="submit-btn" id="add-first-offer-btn">
                <i class="fas fa-plus-circle"></i> إضافة أول عرض
            </button>
        </div>
    `;
}

function getOfferCardHTML(offer) {
    const createdDate = new Date(offer.created_at).toLocaleDateString('ar-EG');
    
    return `
        <div class="offer-card" data-id="${offer.id}">
            <div class="offer-image-container">
                <img src="${offer.image_url || 'images/placeholder.jpg'}" 
                     alt="${offer.title}"
                     onerror="this.onerror=null; this.src='images/placeholder.jpg'">
            </div>
            <div class="offer-card-content">
                <h4 class="offer-card-title">${offer.title}</h4>
                <p class="offer-card-description">${offer.description}</p>
                <div class="offer-meta">
                    <span class="offer-button-text"><i class="fas fa-mouse-pointer"></i> زر: ${offer.button_text || 'تسوق الآن'}</span>
                    <span class="offer-link"><i class="fas fa-link"></i> رابط: ${offer.link || '#products'}</span>
                    <span class="offer-date"><i class="fas fa-calendar"></i> ${createdDate}</span>
                </div>
                <div class="offer-card-actions">
                    <button class="action-btn edit-btn" data-id="${offer.id}" data-action="edit">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="action-btn delete-btn" data-id="${offer.id}" data-action="delete">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                </div>
            </div>
        </div>
    `;
}

function displayOffersSlider(offers) {
    const sliderTrack = document.getElementById('slider-track');
    if (!sliderTrack) {
        return;
    }
    
    if (!offers || offers.length === 0) {
        sliderTrack.innerHTML = `
            <div class="slide">
                <div class="default-slide">
                    <h3>مرحباً بكم في سجى ستور</h3>
                    <p>اكتشف أحدث العروض والتصاميم الحصرية</p>
                    <a href="#products" class="slide-btn">تسوق الآن</a>
                </div>
            </div>
        `;
        setTimeout(() => initSlider(true), 100);
        return;
    }
    
    const slidesHTML = offers.map(offer => getOfferSlideHTML(offer)).join('');
    sliderTrack.innerHTML = slidesHTML;
    
    setTimeout(() => {
        initSlider(true);
        preloadAllImages();
    }, 100);
}

function preloadAllImages() {
    const images = document.querySelectorAll('.slide-background img');
    images.forEach(img => {
        if (!img.complete) {
            const tempImg = new Image();
            tempImg.src = img.src;
        }
    });
}

function getDefaultSlideHTML() {
    return `
        <div class="slide">
            <div class="default-slide" style="background: linear-gradient(135deg, #c245d8, #a8329b); height: 400px; display: flex; align-items: center; justify-content: center; color: white; text-align: center;">
                <div class="slide-content">
                    <i class="fas fa-images" style="font-size: 60px; margin-bottom: 20px;"></i>
                    <h3 style="font-size: 28px; margin-bottom: 15px;">مرحباً بكم في سجى ستور</h3>
                    <p style="font-size: 18px; margin-bottom: 25px; opacity: 0.9;">اكتشف أحدث العروض والتصاميم الحصرية</p>
                    <a href="#products" class="slide-btn" style="background: white; color: #a8329b; padding: 12px 30px; border-radius: 30px; text-decoration: none; font-weight: bold;">
                        <i class="fas fa-shopping-cart"></i> تسوق الآن
                    </a>
                </div>
            </div>
        </div>
    `;
}

function getOfferSlideHTML(offer) {
    const imageUrl = offer.image_url || 'images/placeholder.jpg';
    const imageSrc = imageUrl.includes('supabase.co') ? imageUrl + '?t=' + Date.now() : imageUrl;
    
    return `
        <div class="slide">
            <div class="slide-background">
                <img src="${imageSrc}" 
                     alt="${offer.title}"
                     loading="eager"
                     data-src="${imageUrl}"
                     onload="this.parentElement.classList.add('loaded'); this.style.opacity='1';"
                     onerror="this.onerror=null; this.src='images/placeholder.jpg'; this.parentElement.classList.add('loaded'); this.style.opacity='1';">
            </div>
            <div class="slide-content">
                <h3>${offer.title}</h3>
                <p>${offer.description}</p>
                <a href="${offer.link || '#products'}" class="slide-btn">
                    <i class="fas fa-shopping-cart"></i> ${offer.button_text || 'تسوق الآن'}
                </a>
            </div>
        </div>
    `;
}

async function addOffer(offerData) {
    try {
        const { data, error } = await supabase
            .from('offers')
            .insert([{
                title: offerData.title,
                description: offerData.description,
                button_text: offerData.button_text,
                link: offerData.link,
                image_url: offerData.image_url,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        
        return data[0];
        
    } catch (error) {
        throw error;
    }
}

async function updateOffer(offerId, offerData) {
    try {
        const updateData = {
            title: offerData.title,
            description: offerData.description,
            button_text: offerData.button_text,
            link: offerData.link,
            updated_at: new Date().toISOString()
        };

        if (offerData.image_url) {
            updateData.image_url = offerData.image_url;
        }

        const { data, error } = await supabase
            .from('offers')
            .update(updateData)
            .eq('id', offerId)
            .select();

        if (error) throw error;

        return data[0];
        
    } catch (error) {
        throw error;
    }
}

async function uploadOfferImage(imageFile) {
    if (!imageFile) {
        return null;
    }
    
    try {
        const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const fileExtension = imageFile.name.split('.').pop();
        const fileName = `offers/${uniqueId}.${fileExtension}`;
        
        const { data, error } = await supabase.storage
            .from('images')
            .upload(fileName, imageFile, {
                cacheControl: '3600',
                upsert: false,
                contentType: imageFile.type
            });

        if (error) {
            throw new Error('فشل في رفع الصورة: ' + error.message);
        }

        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(fileName);

        return urlData.publicUrl;
        
    } catch (error) {
        throw error;
    }
}

async function editOffer(offerId) {
    try {
        const { data: offer, error } = await supabase
            .from('offers')
            .select('*')
            .eq('id', offerId)
            .single();

        if (error) throw error;

        currentEditingOfferId = offerId;
        
        populateOfferForm(offer);
        showOfferForm();
        
    } catch (error) {
        alert('❌ حدث خطأ في تحميل بيانات العرض: ' + error.message);
    }
}

function populateOfferForm(offer) {
    document.getElementById('offer-title').value = offer.title || '';
    document.getElementById('offer-description').value = offer.description || '';
    document.getElementById('offer-button-text').value = offer.button_text || 'تسوق الآن';
    document.getElementById('offer-link').value = offer.link || '';
    
    const saveBtn = document.getElementById('save-offer-btn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> تحديث العرض';
    }
    
    if (offer.image_url) {
        if (offerImagePreview) {
            offerImagePreview.src = offer.image_url;
            offerImagePreview.style.display = 'block';
            offerImagePreview.id = 'current-offer-image';
        }
        if (offerImageUploadBox) {
            offerImageUploadBox.classList.add('has-image');
        }
        if (removeOfferImageBtn) {
            removeOfferImageBtn.style.display = 'inline-block';
        }
    }
}

async function deleteOffer(offerId) {
    try {
        const { data: offer, error: fetchError } = await supabase
            .from('offers')
            .select('image_url')
            .eq('id', offerId)
            .single();

        if (fetchError) throw fetchError;

        if (offer && offer.image_url) {
            const imagePath = extractImagePathFromUrl(offer.image_url);
            
            if (imagePath) {
                const { error: deleteImageError } = await supabase.storage
                    .from('images')
                    .remove([imagePath]);

                if (deleteImageError) {
                    console.warn('⚠️ لم يتم حذف الصورة من التخزين:', deleteImageError.message);
                }
            }
        }

        const { error: deleteOfferError } = await supabase
            .from('offers')
            .delete()
            .eq('id', offerId);

        if (deleteOfferError) throw deleteOfferError;
        
        await loadOffers();
        
    } catch (error) {
        alert('❌ حدث خطأ في حذف العرض: ' + error.message);
    }
}

function extractImagePathFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.indexOf('images');
        
        if (bucketIndex !== -1) {
            return pathParts.slice(bucketIndex + 1).join('/');
        }
        
        return null;
    } catch {
        return null;
    }
}

function setupGlobalEventDelegation() {
    let isProcessing = false;
    
    document.addEventListener('click', function(e) {
        if (isProcessing) return;
        
        const target = e.target;
        const deleteBtn = target.closest('.delete-btn[data-id]');
        const editBtn = target.closest('.edit-btn[data-id]');
        
        if (deleteBtn && deleteBtn.dataset.id) {
            e.stopPropagation();
            isProcessing = true;
            
            const offerId = deleteBtn.dataset.id;
            const offerTitle = deleteBtn.closest('.offer-card')?.querySelector('.offer-card-title')?.textContent || 'هذا العرض';
            
            const userConfirmed = confirm(`⚠️ هل أنت متأكد من حذف ${offerTitle}؟\n\nهذا الإجراء لا يمكن التراجع عنه.`);
            
            if (userConfirmed) {
                deleteOffer(offerId).finally(() => {
                    isProcessing = false;
                });
            } else {
                isProcessing = false;
            }
        }
        
        if (editBtn && editBtn.dataset.id) {
            e.preventDefault();
            e.stopPropagation();
            
            if (isProcessing) return;
            
            isProcessing = true;
            const offerId = editBtn.dataset.id;
            
            editOffer(offerId).finally(() => {
                setTimeout(() => {
                    isProcessing = false;
                }, 500);
            });
        }
    });
}

function safeInitialize() {
    try {
        const offersTab = document.getElementById('offers-tab');
        const sliderTrack = document.getElementById('slider-track');
        
        if (!offersTab && !sliderTrack) {
            setTimeout(safeInitialize, 500);
            return;
        }
        
        setupGlobalEventDelegation();
        
        if (sliderTrack) {
            addLoadingStyles();
            loadOffers();
        }
        
        if (offersTab && offersTab.classList.contains('active')) {
            initializeOfferManagement();
        }
        
    } catch (error) {
        setTimeout(safeInitialize, 1000);
    }
}

function addLoadingStyles() {
    if (!document.getElementById('slider-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'slider-loading-styles';
        style.textContent = `
            .slide-background {
                position: relative;
                width: 100%;
                height: 100%;
                overflow: hidden;
            }
            
            .slide-background img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: opacity 0.8s ease;
                opacity: 0;
            }
            
            .slide-background img.loaded,
            .slide-background.loaded img {
                opacity: 1;
            }
            
            .loading-slide {
                background: linear-gradient(135deg, #f5f5f5, #e0e0e0);
                color: #666;
            }
            
            .slider-dot {
                transition: all 0.3s ease;
            }
            
            .slider-track {
                transition: transform 0.5s ease;
            }
            
            .delete-btn {
                transition: background-color 0.3s;
            }
            
            .delete-btn:active {
                background-color: #dc3545 !important;
            }
            
            .slide {
                min-width: 100%;
                box-sizing: border-box;
            }
        `;
        document.head.appendChild(style);
    }
}

function initializeOnLoad() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(safeInitialize, 300);
        });
    } else {
        setTimeout(safeInitialize, 300);
    }
}

initializeOnLoad();

if (typeof window !== 'undefined') {
    window.initializeOfferManagement = initializeOfferManagement;
    window.loadOffers = loadOffers;
    window.showOfferForm = showOfferForm;
    window.editOffer = editOffer;
    window.deleteOffer = deleteOffer;
    window.initSlider = initSlider;
}