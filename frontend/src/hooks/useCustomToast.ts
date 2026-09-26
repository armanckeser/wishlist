import { useCallback } from "react"
import { toast } from "sonner"

const useCustomToast = () => {
  const showSuccessToast = useCallback((description: string) => {
    toast.success("Success!", {
      description,
    })
  }, [])

  const showErrorToast = useCallback((description: string) => {
    toast.error("Something went wrong!", {
      description,
    })
  }, [])

  const showInfoToast = useCallback((description: string) => {
    toast.info("Info", {
      description,
    })
  }, [])

  return { showSuccessToast, showErrorToast, showInfoToast }
}

export default useCustomToast
