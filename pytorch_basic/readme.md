# PyTorch Installation in Windows WSL

1. Check software compatibilities at PyTorch site: https://pytorch.org/get-started/locally/
2. Install required CUDA version from toolkit archive (For me its 12.4): https://developer.nvidia.com/cuda-toolkit-archive
3. Install WSL and restart: `wsl install`
4. Install mini-conda in WSL: https://docs.anaconda.com/miniconda/install/#quick-command-line-install
5. Create virtual environment: `conda create -name pytorch_env python=3.12` & `conda activate pytorch_env`
6. Install PyTorch: `pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118`
7. Test installation: `python` & `import torch` & `torch.cuda.is_available()`

# References

1. [PyTorch official site](https://pytorch.org/get-started/locally/)
2. [PyTorch Installation Blog Post](https://www.lavivienpost.com/install-pytorch-gpu-on-windows-complete-guide/#1)
